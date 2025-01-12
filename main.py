import asyncio
import json
import os
import logging
from google import genai
import base64
from aiohttp import WSMsgType

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load API key from environment
API_KEY = os.environ.get('GOOGLE_API_KEY')
if not API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is required")

MODEL = "gemini-2.0-flash-exp"  # use your model ID

# Initialize Gemini client with API key
client = genai.Client(
    api_key=API_KEY,
    http_options={
        'api_version': 'v1alpha',
        'timeout': 300,  # 5 minutes timeout
        'retries': 3
    }
)

async def gemini_session_handler(websocket):
    """Handles the interaction with Gemini API within a websocket session.

    Args:
        websocket: The aiohttp WebSocket connection to the client.
    """
    try:
        config_message = await websocket.receive_str()
        logger.debug(f"Received config message: {config_message}")
        
        config_data = json.loads(config_message)
        logger.debug(f"Parsed config data: {json.dumps(config_data, indent=2)}")
        
        config = config_data.get("setup", {})
        logger.debug(f"Initial config: {json.dumps(config, indent=2)}")
        
        # Add default configuration if not provided
        if "generation_config" not in config:
            config["generation_config"] = {}
            logger.debug("Added default generation_config")
        
        # Ensure both modalities are requested
        if "response_modalities" not in config["generation_config"]:
            config["generation_config"]["response_modalities"] = ["AUDIO", "TEXT"]
            logger.debug("Added default response modalities")
            
        # Add language configuration
        config["generation_config"]["language"] = "en"
        logger.debug("Added language configuration")
            
        config["system_instruction"] = """You are a helpful assistant for screen sharing sessions. Your role is to:
                                        1) Analyze and describe the content being shared on screen
                                        2) Answer questions about the shared content
                                        3) Provide relevant information and context about what's being shown
                                        4) Assist with technical issues related to screen sharing
                                        5) Maintain a professional and helpful tone. Focus on being concise and clear in your responses."""
        
        logger.debug(f"Final config being sent to Gemini: {json.dumps(config, indent=2)}")

        logger.info("Connecting to Gemini API...")
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            logger.info("Connected to Gemini API")

            async def send_to_gemini():
                """Sends messages from the client websocket to the Gemini API."""
                try:
                    async for msg in websocket:
                        if msg.type == WSMsgType.TEXT:
                            try:
                                data = json.loads(msg.data)
                                if "realtime_input" in data:
                                    for chunk in data["realtime_input"]["media_chunks"]:
                                        if chunk["mime_type"] == "audio/pcm":
                                            logger.debug("Sending audio chunk to Gemini")
                                            logger.debug(f"Audio chunk size: {len(chunk['data'])}")
                                            logger.debug(f"Audio chunk format: {type(chunk['data'])}")
                                            logger.debug(f"Audio chunk sample: {chunk['data'][:100]}")  # Log first 100 chars
                                            try:
                                                # Ensure data is properly formatted
                                                audio_payload = {
                                                    "mime_type": "audio/pcm",
                                                    "data": chunk["data"],
                                                    "sample_rate": 16000,  # Add explicit sample rate
                                                    "encoding": "LINEAR16"  # Add explicit encoding
                                                }
                                                logger.debug(f"Sending audio payload: {audio_payload}")
                                                await session.send(audio_payload)
                                                logger.debug("Audio chunk sent successfully")
                                            except Exception as e:
                                                logger.error(f"Error details: {str(e)}")
                                                logger.error(f"Error type: {type(e)}")
                                        elif chunk["mime_type"] == "image/jpeg":
                                            logger.debug("Sending image to Gemini")
                                            await session.send({"mime_type": "image/jpeg", "data": chunk["data"]})
                                            logger.debug("Image sent successfully")
                            except json.JSONDecodeError as e:
                                logger.error(f"Error decoding JSON: {e}")
                            except Exception as e:
                                logger.error(f"Error sending to Gemini: {e}")
                        elif msg.type == WSMsgType.BINARY:
                            logger.debug("Received binary message, ignoring")
                            continue
                        elif msg.type == WSMsgType.ERROR:
                            logger.error(f"WebSocket error: {msg.data}")
                            break
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.CLOSED, 8):
                            logger.info("WebSocket closing")
                            break
                        elif msg.type == WSMsgType.PING:
                            await websocket.pong()
                        elif msg.type == WSMsgType.PONG:
                            continue
                        else:
                            logger.debug(f"Unhandled message type: {msg.type}")
                            continue
                except Exception as e:
                    logger.error(f"Error in send_to_gemini: {e}")
                finally:
                    logger.info("send_to_gemini closed")

            async def receive_from_gemini():
                """Receives responses from the Gemini API and forwards them to the client."""
                try:
                    while True:
                        try:
                            logger.debug("Waiting for Gemini response")
                            async for response in session.receive():
                                if response.server_content is None:
                                    logger.warning(f'Unhandled server message! - {response}')
                                    continue

                                model_turn = response.server_content.model_turn
                                if model_turn:
                                    for part in model_turn.parts:
                                        if hasattr(part, 'text') and part.text is not None:
                                            logger.debug("Received text response from Gemini")
                                            logger.debug(f"Text content: {part.text}")
                                            text_message = json.dumps({"text": part.text})
                                            logger.debug(f"Sending text message to client: {text_message}")
                                            await websocket.send_str(text_message)
                                        elif hasattr(part, 'inline_data') and part.inline_data is not None:
                                            logger.debug(f"Received audio response from Gemini: {part.inline_data.mime_type}")
                                            base64_audio = base64.b64encode(part.inline_data.data).decode('utf-8')
                                            await websocket.send_str(json.dumps({
                                                "audio": base64_audio
                                            }))
                                            logger.debug("Audio response sent to client")

                                if response.server_content.turn_complete:
                                    logger.debug('Turn complete')

                        except Exception as e:
                            logger.error(f"Error receiving from Gemini: {e}")
                            break

                except Exception as e:
                    logger.error(f"Error in receive_from_gemini: {e}")
                finally:
                    logger.info("Gemini connection closed (receive)")

            # Start both tasks
            send_task = asyncio.create_task(send_to_gemini())
            receive_task = asyncio.create_task(receive_from_gemini())

            try:
                await asyncio.gather(send_task, receive_task)
            except asyncio.CancelledError:
                logger.info("Tasks cancelled")
            finally:
                send_task.cancel()
                receive_task.cancel()

    except Exception as e:
        logger.error(f"Error in Gemini session: {e}")
    finally:
        logger.info("Gemini session closed.")

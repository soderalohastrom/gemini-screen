import asyncio
import json
import os
import logging
from google import genai
import base64
from aiohttp import WSMsgType

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

# Set up logging with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Log startup configuration
logger.info("Starting Gemini Screen Share Application")
logger.debug(f"API Key configured: {'Yes' if API_KEY else 'No'}")
logger.debug(f"Using model: {MODEL}")

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
        config["system_instruction"] = """You are a helpful assistant for screen sharing sessions. Your role is to:
                                        1) Analyze and describe the content being shared on screen
                                        2) Answer questions about the shared content
                                        3) Provide relevant information and context about what's being shown
                                        4) Assist with technical issues related to screen sharing
                                        5) Maintain a professional and helpful tone. Focus on being concise and clear in your responses."""

        logger.info("Connecting to Gemini API with config:")
        logger.debug(f"Model: {MODEL}")
        logger.debug(f"Generation config: {json.dumps(config.get('generation_config', {}), indent=2)}")
        logger.debug(f"System instruction: {config.get('system_instruction', '')}")
        
        try:
            async with client.aio.live.connect(model=MODEL, config=config) as session:
                logger.info("Connected to Gemini API successfully")
                
                async def send_to_gemini():
                    """Sends messages from the client websocket to the Gemini API."""
                    try:
                        async for msg in websocket:
                            try:
                                logger.debug(f"Received text message: {msg.data[:200]}...")  # Log first 200 chars
                                data = json.loads(msg.data)
                                if "realtime_input" in data:
                                    logger.debug("Processing realtime input")
                                    for chunk in data["realtime_input"]["media_chunks"]:
                                        if chunk["mime_type"] == "audio/pcm":
                                            logger.debug("Processing audio chunk")
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
                                                logger.error(f"Error sending audio chunk: {str(e)}")
                                                logger.error(f"Error type: {type(e)}")
                                                logger.error(f"Error traceback: {e.__traceback__}")
                                        elif chunk["mime_type"] == "image/jpeg":
                                            logger.debug("Processing image chunk")
                                            logger.debug(f"Image data size: {len(chunk['data'])}")
                                            try:
                                                await session.send({"mime_type": "image/jpeg", "data": chunk["data"]})
                                                logger.debug("Image sent successfully")
                                            except Exception as e:
                                                logger.error(f"Error sending image: {str(e)}")
                                                logger.error(f"Error type: {type(e)}")
                                                logger.error(f"Error traceback: {e.__traceback__}")
                                else:
                                    logger.debug(f"Received non-realtime message: {json.dumps(data, indent=2)}")
                            except json.JSONDecodeError as e:
                                logger.error(f"Error decoding JSON: {e}")
                                logger.error(f"Raw message data: {msg.data[:200]}...")
                            except Exception as e:
                                logger.error(f"Error processing message: {e}")
                                logger.error(f"Error type: {type(e)}")
                                logger.error(f"Error traceback: {e.__traceback__}")
                    except Exception as e:
                        logger.error(f"Error in send_to_gemini: {e}")
                        logger.error(f"Error type: {type(e)}")
                        logger.error(f"Error traceback: {e.__traceback__}")
                    finally:
                        logger.info("send_to_gemini closed")

                async def receive_from_gemini():
                    """Receives responses from the Gemini API and forwards them to the client."""
                    try:
                        while True:
                            try:
                                logger.debug("Waiting for Gemini response")
                                async for response in session.receive():
                                    logger.debug(f"Raw response from Gemini: {response}")
                                    
                                    if response.server_content is None:
                                        logger.warning(f'Unhandled server message! Full response: {response}')
                                        continue

                                    logger.debug(f"Received server content: {response.server_content}")
                                    model_turn = response.server_content.model_turn
                                    if model_turn:
                                        logger.debug(f"Processing model turn with {len(model_turn.parts)} parts")
                                        for part in model_turn.parts:
                                            logger.debug(f"Processing part type: {type(part)}")
                                            logger.debug(f"Part attributes: {dir(part)}")
                                            
                                            if hasattr(part, 'text') and part.text is not None:
                                                logger.debug("Processing text response")
                                                logger.debug(f"Text content: {part.text}")
                                                text_message = json.dumps({"text": part.text})
                                                logger.debug(f"Sending text message to client: {text_message}")
                                                try:
                                                    await websocket.send_str(text_message)
                                                    logger.debug("Text message sent successfully")
                                                except Exception as e:
                                                    logger.error(f"Error sending text message: {e}")
                                                    logger.error(f"Error type: {type(e)}")
                                                    logger.error(f"Error traceback: {e.__traceback__}")
                                                    
                                            elif hasattr(part, 'inline_data') and part.inline_data is not None:
                                                logger.debug("Processing audio response")
                                                logger.debug(f"Audio mime type: {part.inline_data.mime_type}")
                                                logger.debug(f"Audio data size: {len(part.inline_data.data)}")
                                                try:
                                                    base64_audio = base64.b64encode(part.inline_data.data).decode('utf-8')
                                                    audio_message = json.dumps({"audio": base64_audio})
                                                    logger.debug(f"Audio message size: {len(audio_message)}")
                                                    await websocket.send_str(audio_message)
                                                    logger.debug("Audio message sent successfully")
                                                except Exception as e:
                                                    logger.error(f"Error sending audio message: {e}")
                                                    logger.error(f"Error type: {type(e)}")
                                                    logger.error(f"Error traceback: {e.__traceback__}")
                                            else:
                                                logger.warning(f"Unknown part type: {type(part)}")
                                                logger.warning(f"Part content: {part}")

                                    if response.server_content.turn_complete:
                                        logger.debug('Turn complete')

                            except Exception as e:
                                logger.error(f"Error receiving from Gemini: {e}")
                                logger.error(f"Error type: {type(e)}")
                                logger.error(f"Error traceback: {e.__traceback__}")
                                break

                    except Exception as e:
                        logger.error(f"Error in receive_from_gemini: {e}")
                        logger.error(f"Error type: {type(e)}")
                        logger.error(f"Error traceback: {e.__traceback__}")
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
            logger.error(f"Failed to connect to Gemini API: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error traceback: {e.__traceback__}")
            raise

    except Exception as e:
        logger.error(f"Error in Gemini session: {e}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error traceback: {e.__traceback__}")
    finally:
        logger.info("Gemini session closed.")

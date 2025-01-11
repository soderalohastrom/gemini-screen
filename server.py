from aiohttp import web
import asyncio
from main import gemini_session_handler
import os
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

routes = web.RouteTableDef()

@routes.get('/')
async def index(request):
    return web.FileResponse('index.html')

async def websocket_handler(request):
    logger.info("WebSocket connection attempt received")
    
    # Check if it's a WebSocket upgrade request
    if not request.headers.get('Upgrade', '').lower() == 'websocket':
        logger.error("Not a WebSocket upgrade request")
        return web.Response(status=400, text='Invalid request')

    ws = web.WebSocketResponse(heartbeat=30)
    
    # Check if WebSocket connection is possible
    if not ws.can_prepare(request):
        logger.error("Cannot prepare WebSocket connection")
        return web.Response(status=400, text='Invalid request')

    try:
        await ws.prepare(request)
        logger.info("WebSocket connection established")
        
        await gemini_session_handler(ws)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}", exc_info=True)
        if not ws.closed:
            await ws.close()
    finally:
        logger.info("WebSocket connection closed")
        return ws

async def main():
    app = web.Application()
    
    # Add WebSocket handler first
    app.router.add_route('GET', '/ws', websocket_handler)
    
    # Then add routes and static files
    app.add_routes(routes)
    app.router.add_static('/', path='./', show_index=True)
    
    # Add CORS middleware
    app.middlewares.append(
        web.middleware(lambda _, handler: 
            lambda request: handler(request))
    )
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    logger.info("Server starting...")
    await site.start()
    logger.info("Server started on TCP port 8080")
    
    try:
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

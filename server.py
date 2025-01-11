from aiohttp import web
import asyncio
from main import gemini_session_handler
import os

routes = web.RouteTableDef()

@routes.get('/')
async def index(request):
    return web.FileResponse('index.html')

async def main():
    app = web.Application()
    app.add_routes(routes)
    
    # Serve static files from current directory
    app.router.add_static('/', path='./', show_index=True)
    
    # Add WebSocket handler
    app.router.add_route('GET', '/ws', gemini_session_handler)
    
    runner = web.AppRunner(app)
    await runner.setup()
    # Changed from localhost to 0.0.0.0 to allow external connections
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    print("Server started at http://0.0.0.0:8080")
    await site.start()
    
    try:
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

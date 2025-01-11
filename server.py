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
    
    # Only use TCP
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    print("Server starting...")
    await site.start()
    print("Server started on TCP port 8080")
    
    try:
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

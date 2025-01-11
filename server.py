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
    # Listen on both Unix socket and TCP
    unix_site = web.UnixSite(runner, '/tmp/gemini-screen.sock')
    tcp_site = web.TCPSite(runner, '0.0.0.0', 8080)
    
    print("Server starting...")
    await unix_site.start()
    await tcp_site.start()
    print("Server started on Unix socket and TCP port 8080")
    
    try:
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    # Ensure socket file permissions
    if os.path.exists('/tmp/gemini-screen.sock'):
        os.remove('/tmp/gemini-screen.sock')
    asyncio.run(main())

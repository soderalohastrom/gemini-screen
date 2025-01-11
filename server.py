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

    # Clean up old socket if it exists
    socket_path = '/tmp/gemini-screen.sock'
    if os.path.exists(socket_path):
        os.remove(socket_path)

    # Start the server
    unix_site = web.UnixSite(runner, socket_path)
    tcp_site = web.TCPSite(runner, '0.0.0.0', 8080)
    
    print("Server starting...")
    await unix_site.start()
    # Set socket permissions after it's created
    os.chmod(socket_path, 0o777)
    await tcp_site.start()
    print("Server started on Unix socket and TCP port 8080")
    
    try:
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\nShutting down...")
        # Clean up socket on shutdown
        if os.path.exists(socket_path):
            os.remove(socket_path)
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

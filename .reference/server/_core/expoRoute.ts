import { Request, Response } from "express";
import cookie from "cookie";
import { COOKIE_NAME } from "@shared/const";

export function handleExpoRoute(req: Request, res: Response) {
  // Pass session cookie to Expo app via URL parameter for authentication
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionToken = cookies[COOKIE_NAME] || '';
  const expoPort = process.env.EXPO_PORT || '8082';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>LocoMotivate - Mobile App</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; }
        body { 
          font-family: system-ui, -apple-system, sans-serif;
          background: #000;
        }
        .header {
          background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
          color: white;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 48px;
        }
        .header h1 { font-size: 16px; font-weight: 600; }
        .header a {
          color: white;
          text-decoration: none;
          padding: 6px 12px;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
          font-size: 13px;
        }
        .header a:hover { background: rgba(255,255,255,0.3); }
        .phone-frame {
          display: flex;
          justify-content: center;
          align-items: center;
          height: calc(100% - 48px);
          padding: 16px;
          background: #1a1a1a;
        }
        .phone {
          width: 375px;
          height: calc(100vh - 80px);
          max-height: 812px;
          background: #000;
          border-radius: 40px;
          overflow: hidden;
          box-shadow: 0 0 0 12px #1a1a1a, 0 0 0 14px #333, 0 25px 50px rgba(0,0,0,0.5);
          position: relative;
        }
        .phone::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 150px;
          height: 30px;
          background: #000;
          border-radius: 0 0 20px 20px;
          z-index: 10;
        }
        .phone iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: #fff;
        }
        .loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #666;
          font-size: 14px;
          text-align: center;
        }
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #333;
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📱 LocoMotivate Mobile</h1>
        <a href="/">← Back to Web App</a>
      </div>
      <div class="phone-frame">
        <div class="phone">
          <div class="loading" id="loading">
            <div class="loading-spinner"></div>
            <div>Loading mobile app...</div>
          </div>
          <iframe 
            id="expo-frame"
            src="http://localhost:${expoPort}"
            onload="document.getElementById('loading').style.display='none'"
            allow="accelerometer; camera; microphone; geolocation"
          ></iframe>
        </div>
      </div>
      <script>
        // Inject session token into Expo app via postMessage
        const sessionToken = '${sessionToken}';
        const iframe = document.getElementById('expo-frame');
        iframe.addEventListener('load', function() {
          if (sessionToken) {
            iframe.contentWindow.postMessage({ type: 'MANUS_SESSION', token: sessionToken }, '*');
          }
        });
      </script>
    </body>
    </html>
  `);
}

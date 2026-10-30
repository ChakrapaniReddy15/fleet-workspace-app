const unavailableDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Workspace not found | Fleet Workspace</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: #f5f7f5; color: #17231f; font: 15px/1.5 Arial, Helvetica, sans-serif; }
      main { width: min(100%, 430px); padding: 34px; border: 1px solid #e4e9e6; border-radius: 15px; background: #fff; box-shadow: 0 12px 40px rgb(28 54 41 / 7%); }
      strong { color: #13644b; font-size: 11px; letter-spacing: .13em; }
      h1 { margin: 18px 0 8px; font-size: 30px; letter-spacing: -.04em; }
      p { color: #74817b; font-size: 13px; }
      a { display: inline-block; margin-top: 8px; padding: 9px 12px; border: 1px solid #dce4df; border-radius: 7px; color: #13644b; font-size: 12px; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <strong>FLEET WORKSPACE</strong>
      <h1>Workspace not found</h1>
      <p>This workspace or vehicle is unavailable. It may not exist, or you may not have access.</p>
      <a href="/">Return to your workspace</a>
    </main>
  </body>
</html>`;

export function GET() {
  return new Response(unavailableDocument, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

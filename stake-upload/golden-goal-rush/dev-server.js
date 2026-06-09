const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 6077);
const types = {
	".html": "text/html",
	".css": "text/css",
	".js": "text/javascript",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
};

http
	.createServer((req, res) => {
		let urlPath = decodeURIComponent(req.url.split("?")[0]);
		if (urlPath === "/") urlPath = "/index.html";

		const file = path.normalize(path.join(root, urlPath));
		if (!file.startsWith(root)) {
			res.writeHead(403);
			res.end("Forbidden");
			return;
		}

		fs.readFile(file, (error, data) => {
			if (error) {
				res.writeHead(404);
				res.end("Not found");
				return;
			}

			res.writeHead(200, {
				"Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
			});
			res.end(data);
		});
	})
	.listen(port, "127.0.0.1", () => {
		console.log(`Golden Goal Rush running at http://127.0.0.1:${port}`);
	});

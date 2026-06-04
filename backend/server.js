// Simple example backend showing provably-fair endpoints
// Note: This is a demonstration. For production use, secure keys and audit properly.
const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// Server seed is created per session and its hash published before plays.
let currentServerSeed = crypto.randomBytes(32).toString('hex');

app.get('/server-seed-hash', (req, res) => {
  const hash = crypto.createHash('sha256').update(currentServerSeed).digest('hex');
  res.json({ serverSeedHash: hash });
});

// Endpoint to reveal the server seed after a session (example)
app.get('/reveal-server-seed', (req, res) => {
  res.json({ serverSeed: currentServerSeed });
  // rotate seed
  currentServerSeed = crypto.randomBytes(32).toString('hex');
});

app.listen(3000, () => console.log('Backend example running on http://localhost:3000'));

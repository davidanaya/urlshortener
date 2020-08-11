const express = require("express");
const shortid = require("shortid");
const validUrl = require("valid-url");
const config = require("./config");

const PORT = config.port;
const baseUrl = `${config.host}:${PORT}`;

// Express app setup

const app = express();

app.use(express.json({}));

// Postgres client setup

const { Pool } = require("pg");

const pgClient = new Pool({
  user: config.pgUser,
  host: config.pgHost,
  database: config.pgDatabase,
  password: config.pgPassword,
  port: config.pgPort,
});

pgClient
  .query(
    `CREATE TABLE IF NOT EXISTS urls (
        code VARCHAR(14) PRIMARY KEY,
        long TEXT UNIQUE,
        short TEXT UNIQUE,
        count INTEGER NOT NULL DEFAULT 0)`
  )
  .catch((err) => console.log(err));

// Express route handlers

app.get("/", (_req, res) => res.send("hi"));
app.get("/healthcheck", healthCheck);
app.get("/:code", getShortenUrlRoute);
app.post("/shorturl", shortUrlRoute);

function healthCheck(_req, res) {
  const health = {
    message: "OK",
    timestamp: Date.now(),
  };
  try {
    return res.json(health);
  } catch (err) {
    health.message = err;
    return res.status(503).json(health);
  }
}

async function getShortenUrlRoute(req, res) {
  const code = req.params.code;

  try {
    const { rows } = await pgClient.query(
      "SELECT * FROM urls WHERE code = $1",
      [code]
    );
    const url = rows[0];
    if (url) {
      await pgClient.query("UPDATE urls SET count = $1 WHERE code = $2", [
        url.count + 1,
        code,
      ]);
      return res.redirect(url.long);
    }
    return res.status(400).json("The short url doesn't exists in our system.");
  } catch (err) {
    console.error(err.message);
    return res.status(500).json("Internal Server error " + err.message);
  }
}

async function shortUrlRoute(req, res) {
  const longUrl = req.body.longUrl;
  if (!validUrl.isUri(baseUrl)) {
    return res.status(401).json("Internal error. Please come back later.");
  }

  if (validUrl.isUri(longUrl)) {
    try {
      const {
        rows,
      } = await pgClient.query("SELECT * FROM urls WHERE long = $1", [longUrl]);

      if (rows[0]?.code) {
        return res.status(200).json(rows[0]);
      } else {
        const code = shortid.generate();
        const shortUrl = baseUrl + "/" + code;

        const {
          rows,
        } = await pgClient.query(
          "INSERT INTO urls(code, long, short) VALUES($1, $2, $3) RETURNING *",
          [code, longUrl, shortUrl]
        );

        return res.status(201).json(rows[0]);
      }
    } catch (err) {
      console.error(err.message);
      return res.status(500).json("Internal Server error " + err.message);
    }
  } else {
    res
      .status(400)
      .json("Invalid URL. Please enter a valid url for shortening.");
  }
}

app.listen(PORT, () => console.log("Server is listening on port " + PORT));

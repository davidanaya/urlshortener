const express = require("express");
const shortid = require("shortid");
const validUrl = require("valid-url");

const app = express();

const db = {
  byLongUrl: {},
  byUrlCode: {},
};
const baseUrl = "http://localhost:3000/v1";

app.use(express.json({}));

const PORT = 3000;
app.listen(PORT, () => console.log("Server is listening on port " + PORT));

app.get("/v1/healthcheck", healthCheck);
app.get("/v1/:shortUrl", getShortenUrlRoute);
app.post("/v1/shorturl", shortUrlRoute);

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

function getShortenUrlRoute(req, res) {
  console.log("getShortenUrlRoute", req.params.shortUrl);
  var shortUrlCode = req.params.shortUrl;
  const url = db.byUrlCode[shortUrlCode];

  try {
    if (url) {
      const clickCount = url.clickCount;
      const newUrl = { ...url, clickCount: clickCount + 1 };
      db.byUrlCode[shortUrlCode] = newUrl;
      return res.redirect(url.longUrl);
    } else {
      return res
        .status(400)
        .json("The short url doesn't exists in our system.");
    }
  } catch (err) {
    console.error(
      "Error while retrieving long url for shorturlcode " + shortUrlCode
    );
    return res.status(500).json("There is some internal error.");
  }
}

function shortUrlRoute(req, res) {
  console.log("shortUrlRoute", req.body.longUrl);
  const longUrl = req.body.longUrl;
  if (!validUrl.isUri(baseUrl)) {
    return res.status(401).json("Internal error. Please come back later.");
  }

  if (validUrl.isUri(longUrl)) {
    try {
      let urlCode = db.byLongUrl[longUrl];
      if (urlCode) {
        return res.status(200).json(db.byUrlCode[urlCode]);
      } else {
        urlCode = shortid.generate();

        const shortUrl = baseUrl + "/" + urlCode;
        const url = {
          longUrl,
          shortUrl,
          urlCode,
          clickCount: 0,
        };

        db.byLongUrl[longUrl] = urlCode;
        db.byUrlCode[urlCode] = url;
        return res.status(201).json(url);
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

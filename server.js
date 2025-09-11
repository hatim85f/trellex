const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");

const app = express();

connectDB();

app.get("/", (req, res) => {
  res.status(200).send("Trellex DB API is running");
});

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

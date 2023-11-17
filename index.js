require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;
// const port = 3001;

var cors = require('cors');

const relay_server = require('./relay_server');

app.use(cors());
app.use(express.json());

// app.post('/relay', (req, res) => {
//   relay_server.confirmAndSend(req)
//   .then(response => {
//     res.status(200).send(response);
//   })
//   .catch(error => {
//     res.status(500).send(error);
//   })
// });

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds

app.post('/relay', (req, res) => {
  let retries = 0;

  const sendRequest = () => {
    relay_server.confirmAndSend(req)
      .then(response => {
        res.status(200).send(response);
      })
      .catch(error => {
        if (retries < MAX_RETRIES) {
          retries++;
          setTimeout(sendRequest, RETRY_DELAY); // Retry the request after the delay
          // sendRequest(); // Retry the request
        } else {
          res.status(500).send(error); // Return 500 error after maximum retries
        }
      });
  };

  sendRequest();
});

app.listen(port, () => {
  console.log(`App running on port ${port}.`)
});

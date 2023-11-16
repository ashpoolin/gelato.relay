require('dotenv').config();
const express = require('express');
const app = express();
// const port = 3001;
const port = 3000;

var cors = require('cors');

const webhook_server = require('./relay_server');

app.use(cors());
app.use(express.json());

// app.post('/relay', (req, res) => {
//   webhook_server.confirmAndSend(req)
//   .then(response => {
//     res.status(200).send(response);
//   })
//   .catch(error => {
//     res.status(500).send(error);
//   })
// });

const MAX_RETRIES = 3;

app.post('/relay', (req, res) => {
  let retries = 0;

  const sendRequest = () => {
    webhook_server.confirmAndSend(req)
      .then(response => {
        res.status(200).send(response);
      })
      .catch(error => {
        if (retries < MAX_RETRIES) {
          retries++;
          sendRequest(); // Retry the request
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

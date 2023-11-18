// const { json } = require('express');
const axios = require("axios");
const bs58 = require("bs58");
const Buffer = require("buffer").Buffer;
const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { publicKey, u64 } = require("@solana/buffer-layout-utils");
const {
  blob,
  u8,
  u32,
  nu64,
  ns64,
  struct,
  seq,
} = require("@solana/buffer-layout"); // Layout
const { connect } = require("http2");
// import BN from 'bn.js';
// import {Buffer} from 'buffer';
require("dotenv").config();

// system program interfaces
const TransferLayout = struct([u32("discriminator"), u64("lamports")]);

let programMap = new Map([
  ["11111111111111111111111111111111", "system"],
  ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "spl-token"],
]);

let MethodMap = new Map([
  ["system_0", "createAccount"],
  ["system_1", "assign"],
  ["system_2", "transfer"],
  ["system_3", "createAccountWithSeed"],
  ["system_4", "advanceNonceAccount"],
  ["stake_0", "initialize"], // confirmed
  ["stake_1", "authorize"], // confirmed
  ["stake_2", "delegate"], // confirmed
  ["stake_3", "split"], // confirmed
  ["stake_4", "withdraw"], // confirmed
  ["stake_5", "deactivate"], // confirmed
  ["stake_7", "merge"], // confirmed
  ["stake_10", "authorizeChecked"], // confirmed
  ["spl-token_3", "transfer"],
  ["spl-token_12", "transferChecked"],
]);

const URL = process.env.CHAINSPLAIN_API_SERVER;
const heliusApiServer = process.env.HELIUS_API_SERVER_DEVNET;
// const heliusApiServer = process.env.HELIUS_API_SERVER_MAINNET;
console.log(`heliusApiServer: ${heliusApiServer}`);
const SOLANA_CONNECTION = new Connection(heliusApiServer, "confirmed");
console.log(`SOLANA_CONNECTION: ${SOLANA_CONNECTION}`);
// allowable transfer values
const CORRECT_DESTINATION = process.env.SOL_TROLL_DESTINATION_ADDRESS;
console.log(`CORRECT_DESTINATION: ${CORRECT_DESTINATION}`);
const CORRECT_LAMPORTS = 1000000;
console.log(`CORRECT_LAMPORTS: ${CORRECT_LAMPORTS}`);
let errCheck = false;
let sigCheck = false;
let destinationCheck = false;
let lamportsCheck = false;
let timeoutCheck = false;
let allowQuery = false;

const confirmAndSend = async (req) => {
  // ping and wake up the fucking server
  // fetch(URL)
  //   .then((response) => {
  //     if (response.ok) {
  //       console.log("Server is awake");
  //     } else {
  //       console.log("Server did not respond as expected");
  //     }
  //   })
  //   .catch((error) => {
  //     console.log("Error occurred while pinging the server:", error);
  //   });

  // // delay to allow server to wake and tx to confirm
  // await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    // const signature = req.body[0];
    // const searchQuery = req.body[1];
    const signature = req.body.signature;
    const searchQuery = req.body.query;
    const data = await SOLANA_CONNECTION.getTransaction(signature);
    const slot = data?.slot;
    const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);
    console.log(`currentEpochTimeInSeconds: ${currentEpochTimeInSeconds}`);
    const timeout = currentEpochTimeInSeconds - 60;
    console.log(`timeout: ${timeout}`);
    const blocktime = data?.blockTime;
    console.log(`blocktime: ${blocktime}`);
    try {
      if (blocktime < timeout) {
        timeoutCheck = false;
        console.log(`Timeout check failed: ${timeoutCheck}`);
        return "Error: transaction is too old.";
      } else {
        timeoutCheck = true;
      }
    } catch (err) {
      console.log(`Error: timeout check failed: ${err}`);
      return "Error: timeout check failed";
    }
    const err = data?.meta.err;
    console.log(`err: ${err}`);
    try {
      if (err !== null || typeof err !== "undefined") {
        errCheck = true;
        console.log(`Error check passed: ${errCheck}`);
      }
    } catch (err) {
      errCheck = false;
      console.log(`Error: error check failed: ${err}`);
    }
    const fee = data?.meta.fee / LAMPORTS_PER_SOL;
    const signatureTx = data?.transaction.signatures[0];
    try {
      if (signatureTx === signature) {
        sigCheck = true;
        console.log(`Signature check passed: ${sigCheck}`);
      }
    } catch (err) {
      sigCheck = false;
      console.log(`Error: signature check failed: ${err}`);
      return "Error: signature check failed - these are not the same signatures";
    }
    data?.transaction.message.instructions.map(async (instruction, index) => {
      const programAddress =
        data?.transaction.message.accountKeys[
          instruction.programIdIndex
        ].toString();
      const program = programMap.get(programAddress);
      const ix = bs58.decode(instruction.data);
      const prefix = ix.slice(0, 4);
      const disc =
        program === "spl-token"
          ? prefix[0]
          : Buffer.from(prefix).readUInt32LE();
      const instructionType = MethodMap.get(`${program}_${disc}`);

      if (program == "system") {
        if (instructionType == "transfer") {
          const deserialized = TransferLayout.decode(ix);
          const lamports = Number(deserialized.lamports);
          try {
            if (lamports >= CORRECT_LAMPORTS) {
              lamportsCheck = true;
              console.log(`Lamports check passed: ${lamportsCheck}`);
            } else {
              console.log(`Error: insufficient lamports: ${lamports}`);
              return "Error: insufficient lamports";
            }
          } catch (err) {
            console.log(`Error: lamports check failed: ${err}`);
            return "Error: lamports check failed";
          }
          const uiAmount = lamports / LAMPORTS_PER_SOL;
          const from =
            data?.transaction.message.accountKeys[instruction.accounts[0]];
          const to =
            data?.transaction.message.accountKeys[instruction.accounts[1]];
          if (to == CORRECT_DESTINATION) {
            destinationCheck = true;
            console.log(`Destination check passed: ${destinationCheck}`);
          } else {
            console.log(`Error: incorrect destination: ${to}`);
          }
          const message = `${program},${instructionType},${signature},${err},${slot},${blocktime},${fee},,,,${from},${to},,,,${uiAmount}`;
          console.log(message);
        }
      } else {
        console.log(`No result: ${signature} not a system::transfer type tx`);
        return "Error: not a system::transfer type tx";
      }
    });

    try {
      if (
        sigCheck &&
        errCheck &&
        lamportsCheck &&
        destinationCheck &&
        timeoutCheck
      ) {
        console.log("All checks passed");
        allowQuery = true;
        console.log(`allowQuery: ${allowQuery}`);
      } else {
        console.log("At least one check is false");
        allowQuery = false;
        console.log(`allowQuery: ${allowQuery}`);
        console.log(`sigCheck: ${sigCheck}`);
        console.log(`errCheck: ${errCheck}`);
        console.log(`lamportsCheck: ${lamportsCheck}`);
        console.log(`destinationCheck: ${destinationCheck}`);
        console.log(`timeoutCheck: ${timeoutCheck}`);
      }
    } catch (err) {
      console.log(`Error: checks failed: ${err}`);
    }
    if (allowQuery) {
      console.log("Allowing query");
      const data = { message: searchQuery };
      console.log(data);

      return axios
        .post(URL, data, {
          headers: {
            "Content-Type": "application/json",
          },
        })
        .then((response) => {
          console.log(response.data);
          return response.data;
        })
        .catch((error) => {
          console.log(error.response.data);
          return error.response.data;
        });
    } else {
      console.log("Not allowing query");
      return "query failed at relay_server.js";
    }
  } catch (err) {
    console.log(err);
    return `general relay server error: ${err}`;
  }
};

module.exports = {
  confirmAndSend,
};

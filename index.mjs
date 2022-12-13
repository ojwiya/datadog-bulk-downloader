#!/usr/bin/env node

import { client, v2, v1 } from "@datadog/datadog-api-client";
import chalk from "chalk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import yargs from "yargs";
const argv = yargs(process.argv).argv;

//Importing querystring module
import querystring from "querystring";

dotenv.config();

async function getLogs(apiInstance, params) {
  const data = [];

  let nextPage = null;
  let n = 0;
  do {
    console.log(
      `Requesting page ${++n} ${nextPage ? `with cursor ${nextPage} ` : ``}`
    );
    const query = nextPage ? { ...params, pageCursor: nextPage } : params;
    const result = await apiInstance.listLogsGet(query);
    data.push(...result.data);
    nextPage = result?.meta?.page?.after;
    console.log(`${result.data.length} results (${data.length} total)`);
  } while (nextPage);

  return data;
}

async function getEvents(apiInstance, params) {
  const data = [];

  let nextPage = null;
  let n = 0;
  do {
    console.log(
      `Requesting page ${++n} ${nextPage ? `with cursor ${nextPage} ` : ``}`
    );
    const query = nextPage ? { ...params, pageCursor: nextPage } : params;
    const result = await apiInstance.listEvents(query);
    data.push(...result.data);
    nextPage = result?.meta?.page?.after;
    console.log(`${result.data.length} results (${data.length} total)`);
  } while (nextPage);

  return data;
}

async function getEventsApiListEventsRequest(
  apiInstance,
  params,
  nextPage = 1
) {
  // let nextPage = 1;
  let n = 0;
  let events = [];
  let fileData = [];

  console.log(
    `Requesting page ${++n} ${nextPage ? `with cursor ${nextPage} ` : ``}`
  );

  //const query = nextPage ? { ...params, pageCursor: nextPage } : params;
  const query = { ...params, page: nextPage };

  return apiInstance
    .listEvents(query)
    .then((data) => {
      events = data.events;

      if (!events) return;

      var erMessages = events.map((value, index, array) => {
        return value.text;
      });

      console.log(
        `Page ${nextPage} - API called successfully. Returned data: ` +
          JSON.stringify(events, null, 4)
      );
      fileData.push(...erMessages);
      nextPage = nextPage++;

      return fileData;
      // recursion on next page.
    })
    .catch((error) => {
      console.error(error);
      return null;
    });

  // data.push(...result.data);
  // nextPage = result?.meta?.page?.after;
  // console.log(`${result.data.length} results (${data.length} total)`);
}

function oneYearAgo() {
  return new Date(new Date().setFullYear(new Date().getFullYear() - 1));
}

async function start(ddVersion) {
  const configuration = client.createConfiguration();

  let data = [];

  try {
    if (!argv.query) {
      console.log(
        chalk.red("Error: No type supplied ('logs' or 'events'), use --type")
      );
      process.exit();
    }

    if (!argv.type) {
      console.log(chalk.red("Error: No query supplied, use --query"));
      process.exit();
    }

    let initialParams = {};
    let apiInstance;

    switch (argv.type) {
      case "events":
        apiInstance = new v1.EventsApi(configuration);
        initialParams = {
          tags: argv.query,
          start: argv.from ? argv.from : 1670345019,
          end: argv.to ? argv.to : Math.floor(Date.now() / 1000),
          page: argv.pageSize ? argv.pageSize : 0,
        };

        let pageData;
        let page = 0;
        do {
          pageData = await getEventsApiListEventsRequest(
            apiInstance,
            initialParams,
            page
          );

          if (pageData) {
            data.push(...pageData);
            page++;
          }
        } while (pageData.length);

        break;
      case "logs":
        apiInstance = new v2.LogsApi(configuration);

        initialParams = {
          filterQuery: argv.query,
          filterIndex: argv.index ?? "main",
          filterFrom: argv.from ? new Date(argv.from) : oneYearAgo(),
          filterTo: argv.top ? new Date(argv.to) : new Date(),
          pageLimit: argv.pageSize ? Math.min(argv.pageSize, 5000) : 1000,
        };
        data = await getLogs(apiInstance, initialParams);
        break;
      default:
        break;
    }

    console.log(
      chalk.cyan(
        "Downloading ${argv.type}:\n" +
          JSON.stringify(initialParams, null, 2) +
          "\n"
      )
    );
  } catch (e) {
    console.log(chalk.red(e.message));
    process.exit(1);
  }

  const outputFile = argv.output ?? "results.json";
  console.log(chalk.cyan(`\nWriting ${data.length} logs to ${outputFile}`));
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

  console.log(chalk.green("Done!"));
}

start(v2);

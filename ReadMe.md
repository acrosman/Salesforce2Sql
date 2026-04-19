# Salesforce2Sql

![Lint Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/lint.yml/badge.svg) ![CodeQL Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/codeql-analysis.yml/badge.svg) ![Electronegativity Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/electronegativity.yml/badge.svg) ![Test Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/tests.yml/badge.svg)

This is a tool to generate a SQL schema to match a Salesforce Org Schema.

![Main Interface](documentation/InterfaceScreenshots/MainScreen.png?raw=true)

Salesforce2Sql will connect to a Salesforce org, allow you to select a collection of objects, and have the schema for those objects replicated to a local database. This can be very useful when working on data migration and archiving projects.

_No data is replicated just the schema._

If you are looking for help migrating data between Salesforce Orgs you may want check out the [Salesforce Open Source Commons Data Generation Toolkit Project](https://github.com/SFDO-Community-Sprints/DataGenerationToolkit).

## Getting Started

Read the full [Getting Started guide](documentation/GettingStarted.md).

_There is also a [getting started guide](https://spinningcode.org/2022/05/getting-started-with-salesforce2sql/) on SpinningCode.org with a bit more commentary._

You can either download the [latest release](https://github.com/acrosman/Salesforce2Sql/releases/latest) for your operating system or run from code.

To make this tool useful you will also need a Salesforce org you want to mirror, and a MySQL, Mariadb, or Postgres database you can create tables in.

### Running From Code

To run the project from code you will need a working copy of [NodeJS](https://nodejs.org) 22 or later.

1. Clone this repo (or create your own fork) to your local machine.
1. Run: `npm install` from the project root directory, and wait for all the packages to load (this takes a few minutes).
1. Run: `npm start`

## Databases

Currently Salesforce2Sql supports MySQL, MariaDB, and Postgres. Other databases supported by [KNEX.JS](https://knexjs.org/) can be added upon request.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

## Getting Involved

If you would like to contribute to this project please feel invited to do so. Feel free to review open [issues](issues) and read the [contributing guide](contributing.md).

## OAuth Setup

Salesforce2Sql supports OAuth2 for connecting to Salesforce. To use it you will need to configure a Salesforce Connected App and then enter the client credentials into Salesforce2Sql.

### Set Up OAuth in Salesforce2Sql

1. Launch Salesforce2Sql.
2. Open the Preferences window.
3. Scroll to **Salesforce OAuth Settings**.
4. Paste in your **OAuth Client ID** and **OAuth Client Secret**.
5. Save your changes.

The client secret is stored using Electron safeStorage so it stays encrypted on your local machine.

After saving your credentials:

1. Return to the main screen.
2. Click **Create New Connection**.
3. Leave **OAuth2** selected.
4. Confirm the login URL:
   - Production orgs usually use `https://login.salesforce.com`
   - Sandboxes usually use `https://test.salesforce.com`
5. Click **Connect**.
6. Sign in to Salesforce in the browser and approve access when prompted.

### Set Up the Connected App in Salesforce

If you do not already have a Connected App for this tool:

1. In Salesforce, go to **Setup**.
2. Open **App Manager**.
3. Click **New Connected App**.
4. Enter the basic app details.
5. Enable **OAuth Settings**.
6. Set the callback URL to `http://localhost/completesetup`.
7. Add the OAuth scopes needed by Salesforce2Sql:
   - **Access and manage your data (api)**
   - **Access your basic information (id, profile, email, address, phone)**
   - **Perform requests on your behalf at any time (refresh_token, offline_access)**
   - **Provide access to your data via the Web (web)**
8. Save the Connected App.
9. After Salesforce finishes provisioning it, copy the **Consumer Key** and **Consumer Secret**.
10. Paste those values into the Salesforce2Sql Preferences window.

### Development and CI Option

For local development or CI, you can also provide the OAuth credentials through environment variables:

```env
SALESFORCE_CLIENT_ID=your_client_id_here
SALESFORCE_CLIENT_SECRET=your_client_secret_here
```

If both stored preferences and environment variables are present, the environment variables are used.

### Security Notes

- Do not commit real OAuth secrets to the repository.
- Do not share production Connected App secrets in screenshots or issue comments.
- Use a sandbox Connected App for development whenever possible.

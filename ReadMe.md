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

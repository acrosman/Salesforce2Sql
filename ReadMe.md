# Salesforce2Sql

![Lint Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/lint.yml/badge.svg) ![CodeQL Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/codeql-analysis.yml/badge.svg) ![Electronegativity Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/electronegativity.yml/badge.svg)

This is a tool to generate a SQL schema to match a Salesforce Org Schema.

![Main Interface](documentation/Interface%20Screenshots/MainScreen.png?raw=true)

Salesforce2Sql will connect to a Salesforce org, allow you to select a collection of objects, and have the schema for those objects replicated to a local database. This can be very useful when working on data migration and archiving projects.

_No data is replicated just the schema._

If you are looking for help migrating data between Salesforce Orgs you may want check out the [Salesforce Open Source Commons Data Generation Toolkit Project](https://github.com/SFDO-Community-Sprints/DataGenerationToolkit).

## Getting Started

You can either download the [latest release](releases/latest) for your operating system or run from code.

There should always be a release for Windows (the exe file is an installer), Mac (the dmg file is a standard disk image), and Linux (the zip file contains the executable and supporting materials). You can also download the source archives if you want to explore the version of the code that went into the release.

To run the project from code you will need a working copy of [NodeJS](https://nodejs.org) 14 or later. To make it useful you will also need a Salesforce org you want to mirro, and a MySQL, Mariadb, or Postgres database you can create tables in.

1. Clone this repo (or create your own fork) to your local machine.
1. Run: `npm install` from the project root directory, and wait for all the packages to load (this takes a few minutes).
1. Run: `npm start`

## Salesforce Login

![Login Screen](documentation/Interface%20Screenshots/Login.PNG?raw=true)

Currently only the username and password login system is supported, not OAuth2, so you likely will need your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5).

In the login fields provide your username, password, and security token. If you are logging into a production or trailhead instance you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com.

## Databases

Currently Salesforce2Sql supports MySQL, MariaDB, and Postgres. Other databases supported by [KNEX.JS](https://knexjs.org/) can be added upon request.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

## Getting Involved

If you would like to contribute to this project please feel invited to do so. Feel free to review open [issues](issues) and read the [contributing guide](contributing.md).

# Salesforce2Sql

![Main Interface](https://github.com/version0chiro/Salesforce2Sql/blob/adding_screenshots_to_readme/documentation/Interface%20Screenshots/Main%20Screen.jpeg?raw=true)


This is a tool to generate a SQL schema to match a Salesforce Org Schema.

Salesforce2Sql will connect to a Salesforce org, allow you to select a collection of objects, and have the schema for those objects replicated to a local database. This can be very useful when working on data migration and archiving projects. _No data is replicated just the schema._ If you are looking for help migrating data between Salesforce Orgs you may want check out the [Salesforce Open Source Commons Data Generation Toolkit Project](https://github.com/SFDO-Community-Sprints/DataGenerationToolkit).

## Salesforce Login

![Login Screen](https://github.com/version0chiro/Salesforce2Sql/blob/adding_screenshots_to_readme/documentation/Interface%20Screenshots/Login.PNG?raw=true)

Currently only the username and password login system is supported, not OAuth2, so you likely will need your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5).

In the login fields provide your username, password, and security token. If you are logging into a production or trailhead instance you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com.

## Databases

Currently Salesforce2Sql supports MySQL, MariaDB, and Postgres. Other databases supported by [KNEX.JS](https://knexjs.org/) can be added upon request.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

## Getting Involved

If you would like to contribute to this project please feel invited to do so. Feel free to review open [issues](issues) and read the [contributing guide](contributing.md).

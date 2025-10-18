# Getting Started

Salesforce2SQL is a schema-only cloning tool, that copies a Salesforce org schema into a traditional database. This is useful for data archiving, migration, backups, and any use case where you may want Salesforce data stored off-platform in patterns that match your Salesforce org.

## Setup

Salesforce2Sql is built and released for MacOS, Windows, and Linux (most testing is on Mac and Windows). You can download the installers from the [current release](https://github.com/acrosman/Salesforce2SQL/releases/latest) and follow the standard patterns for your OS to install the application. From there start the application as you would any other and get to work.

You will need API access to a Salesforce org and a database to create your schema within.

![Main Interface](InterfaceScreenshots/MainScreen.png?raw=true)

## Basic Salesforce2Sql Use

### Login

Click "Create New Connection" to open the login screen. In the login fields provide your username, password, and security token. If you are logging into a production or trailhead instance you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com. You can also enter the [Salesforce My Domain](https://help.salesforce.com/s/articleView?id=xcloud.domain_name_overview.htm&type=5) of your org.

![Login Screen](InterfaceScreenshots/Login.PNG?raw=true)

As of this writing Salesforce2Sql uses the old security token connection method. [OAuth2 support is under development](https://github.com/acrosman/Salesforce2Sql/pull/52). So with the application running, and your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5) in hand, click the big “Create New Connection” button on the left side of the main interface.

### Step 1: Fetch Objects

Once connected click “Fetch Objects”, and the tool will download a list of every object in your org. There may be several hundred. From those you will select which objects you want to mirror by setting the checkbox for each object you want to include in your schema.

Salesforce2Sql selects some objects by default for you based on common data patterns. It will select all custom objects. Additionally, based on your org’s structure, Salesforce2Sql guesses which standard objects are likely in use. There is a search box at the top right to help you find any others you’d like to add. You can uncheck the box for any object you are not interested in including in your schema clone.

### Step 2: Fetch Fields

Click the next button to move to the Proposed Schema tab, and then the “Fetch Details” button.

Salesforce2Sql will query every field on every object you just selected (this may take a few moments). Once that is complete you can either save that schema to JSON for later re-use, or click Next to move to the “Generated Database” tab.

### Step 3: Generate Database Tables

This is the last step. Click “Create Tables” and Salesforce2Sql will ask you for your database credentials.

Once you click okay on this final screen Salesforce2Sql will attempt to create all those tables for you. Again this will take a couple minutes if you have a large schema. Once the process is complete you can also save the SQL statements for editing and/or later re-use.

That’s it, you now have a database with a schema that matches your org’s structure.

## Preferences

There are a few preferences you might want to experiment with when building mirrors. As with so many things the right choices depend on use case.

Preference screen from the application with sections for picklist settings, index settings, other defaults, and theme.

![Preference pane showing sections described above.](InterfaceScreenshots/Sf2SqlPreferences.png?raw=true)

#### Picklists

Salesforce Picklists are a bit of a special beast. The obvious choice is to make a picklist into a SQL Enum to support validation of data. But not all picklists are restricted in Salesforce and aren’t always required. By default the tool will use `enum` for restricted picklists with add a blank value included for optional fields. The default for unrestricted picklists is `varchar`.

If the picklist values in your org are pretty much set, the default settings make a lot of sense. If the picklist values in your org are likely to change you might want to use this preference to set them all into regular `varchar` columns.

#### Auto Indexing

The next important section contains the index settings. While it is possible to over-index a database I think the three sets of default indexes are pretty good guesses: Id columns, external Ids, and picklists.

The one you are most likely not to care about are the picklists/enums, and therefore the one you might consider disabling if you aren’t processing on those fields at all. Id columns are set to be case-sensitive, even in MySQL, by default as of version 0.7.0 since 15-character Salesforce Ids are case sensitive.

#### Additional Settings

The other defaults section let’s you pick a few other system behaviors. The most common to fuss with are first and last in the box.

By default Salesforce2SQL expects Lookup fields to be 18 character Salesforce Ids – cause that’s what they will be in Salesforce. But during a data migration some people like to put legacy Ids into these fields so Salesforce2SQL gives the option to use 255 characters instead of 18.

Salesforce also has two categories of fields that are common to ignore in a migration and you may wish to keep out of your database just for ease of use: the audit fields (createdBy and the like) and read-only fields (like formulas). The final two checkboxes in that other defaults section lets you ignore those fields for your clone schema.

The middle two fields control the behavior of field defaults.

Salesforce2Sql uses [Bootswatch themes](https://bootswatch.com/) for design elements. The preference pane also lets you pick a different look-and-feel from their theme list.

## Additional Notes

If the database creation process runs into a problem where the SQL engine complains about row size limits (common with MySQL) Salesforce2Sql will automatically switch all `varchar` fields to `TEXT` fields in an attempt to reduce the row size. That will override all preference settings for these fields.

Knex.js – which Salesforce2Sql uses to handle the actual SQL writing – adds indexes as a table alter even when they could be part of the create statement. This makes the process a bit slow and it means that if there are errors during the creation of indexes you may see some errors in the interface but leave you with a pretty-good schema clone.

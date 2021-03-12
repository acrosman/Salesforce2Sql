# Electron Salesforce Base

This is a project starter that is taken from a combonation of other projects, and is meant as a jumping off point to create your own Salesforce interfaces using Electron and [JSForce](https://jsforce.github.io/).

This base package provides some plumbing and a the ability to connect to an org (with security token) after that you are on your own. Please extend freely and tell me what you build – I'd love to hear about it.

## Quick Start

    wget -O electron-sf-base.zip https://github.com/acrosman/electron-sf-base/archive/main.zip
    unzip electron-sf-base.zip
    cd electron-sf-base
    npm install
    npm start

One the application is running you'll likely want to update the package.json file, start a git repository, replace this readme, and get to work on your project.

### Log in

Currently only the standard login is supported, not OAuth2, so you likely will need your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5).

In the login fields provide your username, password, and security token. If you are logging into a production or trailhead instance you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com.

## Example Projects

This project was started as a simplifcation of [ElectronForce](https://github.com/acrosman/electronForce) to make it easier to get new projects rolling and to think through ideas.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

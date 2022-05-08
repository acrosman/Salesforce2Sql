I welcome contributions large and small, and I'm happy to help new developers gets started working on public code.

If you have a feature idea or discover a bug, please open an issue so I can track what's going on. Before you take on large work for new features it is generally good to get an affirmation that I'm interested in maintaining the new functionality.

When opening pull requests that address an issue, please include a reference to the issue in the comment so anyone else finding the issue knows you're already working on the problem.

Try to make sure your code passes linting before you open your pull request. I have setup ESLint on this project to follow the airbnb standard (with a few tweaks). All the tools you need should be installed by npm when you setup the code base, and any good editor will have support for helping you find and fix errors. If you don't know how to do that, mention that in your comment, along with your editor and OS, and I'll try to find you directions. I'm not a fan on debating standards but I love having them, so I picked a popular one and I'm following. Issues dedicated to debating the merit of one coding standard vs another will be met with great skepticism. Issues that point out some small detail of airbnb is causing needless headaches are welcome.

I want to contributors provide the best work they can, so I may provide you feedback on your pull request instead of just merging and fixing the issues myself. That's meant to be helpful, but if it gets frustrating please let me know and I'll try to find another way to move it forward.

## Getting Started

Salesforce2Sql is an Electron app built using Node.js. If you are familiar with this environment there shouldn't be any surprises here.

You need to have:
* Node.js (Current LTS versions supported by Electron on supported)
* Git, and a little experience with basic use.
* A good editor (VSCode, Atom, etc).

Steps for your first contribution:
1. [Fork the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks) in github.
1. Clone your fork to your local machine.
1. Run `npm install` on your terminal.
1. Run `npm start` to make sure everything is working.
1. Create a new branch for your work.
1. Make the changes to address the issue you are working on.
1. Run `npm test` to make sure all existing and new automated tests pass.
1. Run `npm lint` to make sure your new code conforms to project standards.
1. Commit your changes, and push the branch to github.
1. Open a Pull Request against the main project. _Please note which issue you are fixing by putting `fixes #[issue-number]` into the comment._

For new contributors github does not automatically run all the checks against your contribution, but I will once I notice it. Future updates will trigger the workflows. I am unlikely to accept a contribution that does not pass all checks. When you see Github report errors, please try to fix them if you are able.

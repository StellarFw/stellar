# Stellar Contributing Guide

Hi! I'm really excited that you are interested in contributing to Stellar. Before submitting your contribution through, please make sure to take a moment and read through the following guidelines.

## Pull Request Guidlines

- Checkout a topic branch from `dev` and merge back against `dev`.

- Work in the `src` or `bin` folders and **DO NOT** checkin `dist` in the commits.

- Squash the commit if there are too many small ones.

- Follow the [code style](#code-style).

- If adding new feature provide convincing reason to add this feature. Ideally you should open a suggestion issue first and have it greenlighted before working on it.

- If fixing a bug provide detailed description of the bug in the PR.

## Code Style

- [No semicolons unless necessary](http://inimino.org/~inimino/blog/javascript_semicolons).

- Follow JSDoc.

- 2 space indentation.

- multiple var declarations.

- 1 space after `function` and function names.

- 1 space between arguments, but not between parentheses.

- Use Arrow functions whenever possible.

- You can use ES6 JavaScript.

- When in doubt, read the source code.

## Development Setup

You will need [Node.js](http://nodejs.org).

```bash
$ npm install
```

Stellar is written in JavaScript ES6 with some additional features like class properties, so the source code needs to be transpiled to ES5 in order to be interpreted by the Node.Js 6.

Dev mode: watch and auto-build during the development:

```bash
$ gulp watch
```

To build:

```bash
$ gulp babel
```

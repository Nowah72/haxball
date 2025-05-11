# HaxBall Clone Multiplayer

A multiplayer clone of the popular HaxBall game, built with Node.js, Express, Socket.IO, and HTML5 Canvas.

## Features

- Real-time multiplayer gameplay
- Team selection system
- In-game chat
- Room-based matchmaking
- Physics-based ball and player movement
- Customizable game settings

## Setup Instructions

### Prerequisites

- Node.js (v12.0.0 or higher)
- npm (usually comes with Node.js)

### Installation

1. Clone this repository or download the files
2. Navigate to the project directory in your terminal
3. Install dependencies:

```bash
npm install
```

### Running the Game

1. Start the server:

```bash
npm start
```

2. Open your browser and go to `http://localhost:3000`

For development with auto-restart:

```bash
npm run dev
```

## Game Controls

- **Move**: WASD or Arrow Keys
- **Shoot/Kick**: Spacebar
- **Chat**: Type in the chat box and press Enter

## Multiplayer Instructions

1. Create a room or join an existing room using the room code
2. Drag players to assign them to teams
3. The host can start the game when at least one player is in each team
4. Play and have fun!

## Running on a Dedicated Server

To run this game on a dedicated server:

1. Clone the repository on your server
2. Install dependencies with `npm install`
3. Start the server with `npm start` or use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start server with PM2
pm2 start server.js --name haxball-clone

# Save PM2 process list
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

4. Configure your firewall to allow connections on port 3000 (or change the port in server.js)

## Customization

- To change the port, modify the `PORT` variable in `server.js`
- Game constants (player speed, ball size, etc.) can be modified in both `server.js` and `public/js/game.js`

## License

This project is open source and available for personal and educational use.

## Acknowledgements

Inspired by the original HaxBall game (https://www.haxball.com)
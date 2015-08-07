var request = require('request'),
    Slack = require('slack-client'),
    token = process.env.TOKEN,
    slack = new Slack(token, true, true),
    tactics = require('./tactics');

var makeMention = function(userId) {
  return '<@' + userId + '>';
};

var isDirect = function(userId, messageText) {
  var userTag = makeMention(userId);
  return messageText &&
    messageText.length >= userTag.length &&
      messageText.substr(0, userTag.length) === userTag;
};

var render_board = function(channel, board) {
  var turn = board.turn() == 'w' ? 'White' : 'Black';
  var url = "http://www.eddins.net/steve/chess/ChessImager/ChessImager.php?fen=" + encodeURIComponent(board.fen());

  if (board.turn() == 'b') {
    url += "&direction=reverse";
  }

  channel.send(url);
  channel.send(turn + ' to move.');
};


slack.on('open', function () {
  var channels = Object.keys(slack.channels)
    .map(function (k) { return slack.channels[k]; })
    .filter(function (c) { return c.is_member; })
    .map(function (c) { return c.name; });

  var groups = Object.keys(slack.groups)
    .map(function (k) { return slack.groups[k]; })
    .filter(function (g) { return g.is_open && !g.is_archived; })
    .map(function (g) { return g.name; });

  console.log('Welcome to Slack. You are ' + slack.self.name + ' of ' + slack.team.name);

  if (channels.length > 0) {
    console.log('You are in: ' + channels.join(', '));
  } else {
    console.log('You are not in any channels.');
  }

  if (groups.length > 0) {
    console.log('As well as: ' + groups.join(', '));
  }
});

slack.on('message', function(message) {
  var channel = slack.getChannelGroupOrDMByID(message.channel);
  var user = slack.getUserByID(message.user);

  if (message.type === 'message' && isDirect(slack.self.id, message.text)) {
    var parts = message.text.split(" ");
    var command = (parts[1] || "").toLowerCase();

    switch (command) {
      case "start":
        tactics.start(function() {
          render_board(channel, tactics.board);
        });
        break;

      case "show":
        render_board(channel, tactics.board);
        break;

      case "move":
        var move = parts[2];

        if (move) {
          tactics.move(move, function(result) {
            if (result.success) {
              if (result.next_move) {
                console.log("Tactics bot moves " + result.next_move);
                render_board(channel, tactics.board);
              } else {
                channel.send("correct!");
                channel.send("new rating: " + result.new_rating);
              }
            } else {
              channel.send("fail. the correct move is: " + result.correct_move);
              channel.send("new rating: " + result.new_rating);
            }
          });
        }

        break;

      case "help":
      default:
        var help  = "Tactics commands:\r\n";
            help += "\t@tactics start                         - starts a tactics puzzle\r\n";
            help += "\t@tactics show                          - displays the current puzzle board\r\n";
            help += "\t@tactics move [MOVE]                   - enter a move for the puzzle\r\n";
            help += "\t@tactics help                          - displays this message\r\n";
            help += "\r\n";

        channel.send(help);
        break;
    }
  }
});

slack.login();

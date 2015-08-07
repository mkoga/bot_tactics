var request = require('request'),
    utils = require('./utils'),
    readline = require('readline'),
    async = require('async'),
    Chess = require('chess.js').Chess;


var Tactics = function() {
  this.board = new Chess();
};

Tactics.prototype.login = function() {
};

Tactics.prototype.start = function(callback) {
  var self = this;
  var url = 'http://chesstempo.com/requests/get_problem_tactic.php';
  request.post({ url: url, form: {prob_id: '-1'}, headers: {Cookie: 'PHPSESSID=uud4m5qja05avml5hvqcuvsrv3;'}}, function(err, res, body) {
    if (!err) {
      self._process_problem(JSON.parse(utils.d(body)));
    }

    callback(err);
  });
};

Tactics.prototype.move = function(move, callback) {
  var self = this;
  var result = { success: false };

  if (!this.problem) {
    callback(result);
    return;
  }

  var players_board = new Chess(this.board.fen());
  var successful_player_move = players_board.move(move);

  var actual_move = this._current_move();
  var move_result = this.board.move(actual_move);
  var last_move = this._last_move(this.board);

  var players_fen = players_board.fen().split(" ")[0];
  var correct_fen = this.board.fen().split(" ")[0];
  result.success = (successful_player_move != null) && (players_fen == correct_fen);

  if (result.success) {
    var comp_move = this._next_move();

    if (comp_move) {
      this.board.move(comp_move);
      result.next_move = this._last_move(this.board);
      this._next_step();
      callback(result);
    } else {
      // done, get new rating
      this._complete(true, function(err, body) {
        result.new_rating = self._rating(body);
        callback(result);
      });
    }
  } else {
    // failed, get new rating
    this._complete(false, function(err, body) {
      result.correct_move = last_move;
      result.new_rating = self._rating(body);
      callback(result);
    });
  }
};

Tactics.prototype._rating = function(body) {
  if (body.new_user_rating && body.rating_change) {
    return body.new_user_rating + " (" + body.rating_change + ")";
  } else {
    return "0 (0)";
  }
};

Tactics.prototype._last_move = function(_board) {
  var history = _board.history();
  return history[history.length - 1];
};

Tactics.prototype._next_step = function() {
  if (!this.problem) {
    return false;
  }

  return this.problem.redditchess.step++;
};

Tactics.prototype._next_move = function() {
  if (!this.problem) {
    return false;
  }

  this._next_step();
  return this._current_move();
};

Tactics.prototype._current_move = function() {
  if (!this.problem) {
    return false;
  }

  return this.problem.redditchess.main_line[this.problem.redditchess.step];
};

Tactics.prototype._process_problem = function(problem) {
  this.problem = problem;
  this.board.load(this.problem.startPos);

  var moves = [];
  var main_line = this.problem.moves.replace(/\([^(]*\)/g, '').trim().split(/\s+/);

  for (var i = 0; i < main_line.length; i++) {
    var move = main_line[i];

    moves.push({
      from: move.substr(0, 2),
      to: move.substr(2, 2)
    });
  }

  this.problem.redditchess = {};
  this.problem.redditchess.step = 0;
  this.problem.redditchess.main_line = moves;
};

Tactics.prototype._complete = function(success, callback) {
  var m = {
    probId: this.problem.problem_id,
    c: success,
    wm: null,
    wmn: null,
    wr: "",
    rid: this.problem.problem_rnum,
    crt: 1,
    lf: 0,
    ac: 0,
    s: 25,
    af: 5,
    dt: 1
  };

  var self = this;
  var url = 'http://chesstempo.com/requests/mark_problem_tactic.php';
  request.post({ url: url, form: {sd: utils.e(JSON.stringify(m))}, headers: {Cookie: 'PHPSESSID=uud4m5qja05avml5hvqcuvsrv3;'} }, function(err, res, body) {
    delete self.problem;
    self.board.reset();

    var parsed_response = JSON.parse(body);
    callback(err, parsed_response);
  });
};


module.exports = new Tactics();

const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at port 3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeDbAndServer();

const jwtAuthorization = (request, response, next) => {
  const requestHeader = request.headers["authorization"];
  if (requestHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    let jwtToken = requestHeader.split(" ")[1];
    jwt.verify(jwtToken, "Vaishnavi", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.user_id = payload.user_id;
        request.name = payload.name;
        console.log(payload);
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const getUser = await db.get(getUserQuery);

  if (getUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUser = `INSERT INTO user(username, password, name,gender )
  VALUES('${username}','${hashedPassword}','${name}','${gender}');
  `;
      const registerUser = db.run(createUser);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const getUser = await db.get(getUserQuery);
  if (getUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, getUser.password);
    if (!isPasswordMatched) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: getUser.username,
        user_id: getUser.user_id,
        name: getUser.name,
      };
      const jwtToken = jwt.sign(payload, "Vaishnavi");
      response.send({ jwtToken });
    }
  }
});

// GET tweets
app.get("/user/tweets/feed/", jwtAuthorization, async (request, response) => {
  const { username } = request;
  console.log(request);
  //console.log("vaishu");
  const getTweetsQuery = `SELECT u2.username AS username,tweet,date_time AS dateTime
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id
    WHERE u1.username='${username}' ORDER BY dateTime DESC LIMIT ${4} OFFSET ${0};`;

  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

// // get user followings id

app.get("/user/following/", jwtAuthorization, async (request, response) => {
  const { username } = request;
  const userFollowingQuery = `SELECT distinct(u2.name) AS name
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id
    WHERE u1.username='${username}';`;

  const userFollowing = await db.all(userFollowingQuery);
  response.send(userFollowing);
});

// //API 5

app.get("/user/followers/", jwtAuthorization, async (request, response) => {
  const { username } = request;
  const userFollowersQuery = `SELECT u2.name AS name FROM user AS u1 INNER JOIN follower
    AS f1 ON u1.user_id=f1.following_user_id INNER JOIN user AS u2
    ON u2.user_id=f1.follower_user_id WHERE u1.username='${username}';`;

  const userFollowers = await db.all(userFollowersQuery);
  response.send(userFollowers);
});

// // API 6
app.get("/tweets/:tweetId/", jwtAuthorization, async (request, response) => {
  const { username } = request;
  const requestParams = request.params;
  const { tweetId } = requestParams;

  const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id
    WHERE u1.username='${username}';`;
  const dbResponse1 = await db.all(tweetQuery);

  const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
    return eachObject.tweet_id_user_following;
  });

  if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const query = `SELECT t.tweet AS tweet, COUNT(DISTINCT l.like_id) AS likes,
    COUNT(DISTINCT r.reply_id) AS replies, t.date_time AS dateTime FROM tweet AS t
    LEFT JOIN like AS l ON t.tweet_id = l.tweet_id LEFT JOIN reply AS r ON t.tweet_id = r.tweet_id
    WHERE t.tweet_id = ${tweetId};`;
    const dbResponse = await db.get(query);

    response.send(dbResponse);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  jwtAuthorization,
  async (request, response) => {
    const { username } = request;
    const requestParams = request.params;
    const { tweetId } = requestParams;

    const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id
    WHERE u1.username='${username}';`;
    const dbResponse1 = await db.all(tweetQuery);

    const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
      return eachObject.tweet_id_user_following;
    });

    if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const query = `SELECT DISTINCT(u1.username) FROM tweet AS t LEFT JOIN like AS l
    ON t.tweet_id = l.tweet_id LEFT JOIN reply AS r ON t.tweet_id = r.tweet_id LEFT JOIN
    user AS u1 ON u1.user_id=l.user_id  WHERE t.tweet_id = ${tweetId};`;
      const dbResponse = await db.all(query);

      const ArrayNames = dbResponse.map((eachObject) => {
        return eachObject.username;
      });

      const dbResponseResult = {
        likes: ArrayNames,
      };
      response.send(dbResponseResult);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  jwtAuthorization,
  async (request, response) => {
    const { user_id } = request;
    const requestParams = request.params;
    const { tweetId } = requestParams;

    const followingQuery = `
      SELECT t.user_id
      FROM tweet AS t
      JOIN user AS u ON t.user_id = u.user_id
      WHERE t.tweet_id = ${tweetId};
    `;

    const dbResponse = await db.get(followingQuery);

    if (!dbResponse) {
      response.status(404);
      response.send("Invalid Request");
    } else {
      const tweetUserId = dbResponse.user_id;

      const isFollowingQuery = `
        SELECT * FROM follower
        WHERE follower_user_id = ${user_id}
        AND following_user_id = ${tweetUserId};
      `;

      const followingResponse = await db.get(isFollowingQuery);

      if (!followingResponse) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        const query = `
          SELECT u1.name AS name, r.reply AS reply
          FROM reply AS r
          JOIN user AS u1 ON r.user_id = u1.user_id
          WHERE r.tweet_id = ${tweetId};
        `;

        const dbReplies = await db.all(query);

        response.send({
          replies: dbReplies,
        });
      }
    }
  }
);

app.get("/user/tweets/", jwtAuthorization, async (request, response) => {
  const { username } = request;
  const query = `SELECT t.tweet AS tweet,COUNT(DISTINCT(l.like_id)) AS likes,COUNT(DISTINCT(r.reply_id)) AS replies,t.date_time AS dateTime
  FROM tweet AS t LEFT JOIN like AS l ON t.tweet_id=l.tweet_id LEFT JOIN reply AS r ON r.tweet_id=t.tweet_id JOIN user AS u ON t.user_id=u.user_id
  WHERE u.username='${username}' GROUP BY t.tweet_id;`;
  const dbResponse = await db.all(query);
  response.send(dbResponse);
});

app.post("/user/tweets/", jwtAuthorization, async (request, response) => {
  const requestBody = request.body;
  const { tweet } = requestBody;
  const { username, user_id } = request;

  const createTweetQuery = `INSERT INTO tweet (tweet, user_id)
VALUES ('${tweet}',${user_id});
`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/", jwtAuthorization, async (request, response) => {
  const { user_id } = request;
  const requestParams = request.params;
  const { tweetId } = requestParams;

  const ownershipQuery = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;
  const dbResponse = await db.get(ownershipQuery);

  if (!dbResponse) {
    response.status(404);
    response.send("Invalid Request");
  } else if (dbResponse.user_id !== user_id) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId}`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;

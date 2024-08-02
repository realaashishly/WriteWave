const cookieParser = require("cookie-parser");
const express = require("express");
const path = require("path");
const app = express();

const userModel = require("./models/user");
const postModel = require("./models/post");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

function isLoggedIn(req, res, next) {
  if (!req.cookies.token) res.redirect("/login");

  let data = jwt.verify(req.cookies.token, "shhh");
  req.user = data;
  next();
}

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  let userExists = await userModel.findOne({ email });
  if (!userExists) {
    return res.status(400).send("Wrong email and passsword");
  }

  bcrypt.compare(password, userExists.password, (err, result) => {
    if (!result) {
      return res.status(400).redirect("/login");
    }

    const token = jwt.sign(
      { email: userExists.email, userid: userExists._id },
      "shhh"
    );
    res.cookie("token", token);
    res.status(200).redirect("/profile");
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).redirect("/login");
});

app.post("/register", async (req, res) => {
  const { name, username, email, age, password } = req.body;

  const userExists = await userModel.findOne({ email });
  if (userExists) {
    console.log(userExists);
    return res.status(400).send("User already exists");
  }

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      if (err) {
        return res.status(500).send(err);
      }

      let user = await userModel.create({
        name,
        username,
        age,
        password: hash,
        email,
      });

      const token = jwt.sign({ email: user.email, userid: user._id }, "shhh");
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    });
  });
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
    // console.log(users);
  res.render("profile", { user });
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let post = await postModel.create({
    user: user._id,
    content: req.body.content,
  });

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.get('/browser', isLoggedIn, async (req, res) => {
  let posts = await postModel.find().populate("user");
  let user = req.user;
  console.log(user.userid);
  console.log(posts);
  res.render('browser', { posts, user });
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
  console.log(req.params);
  let post = await postModel.findById(req.params.id).populate("user");
  if(post.likes.find(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  }
  else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }

  await post.save();
  res.redirect('/browser');
})

app.get('/edit/:id', async (req, res) => {
  let post = await postModel.findById(req.params.id).populate("user");
  res.render('edit', { post });
});

app.post('/edit/:id', async (req, res) => {
  let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
  res.redirect('/profile');
})

app.listen(3000, () => {
  console.log("listening on http://localhost:3000");
});

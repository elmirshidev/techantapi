const express = require('express');
// const cors = require('cors');
const mongoose = require('mongoose');
const VerifyEmail = require('./models/VerifyEmail');
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt');
const generateToken = require('./generateToken')
const cookieParser = require('cookie-parser')
const protect = require('./protect.js')
const multer = require('multer')
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path')
const fs = require('fs')
const PORT = process.env.PORT;
const Post = require('./models/Post.js');
const User = require('./models/User');
const emailjs = require('@emailjs/nodejs')
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
const http = require('http');
// const socketIO  = require('socket.io')
// const { EventEmitter } = require('events')
const cors = require('cors')

const app = express();

const server = http.createServer(app);

const corsOptions = {
 credentials: true,
 origin: 'https://app.techantgram.online',
};

app.use(cors(corsOptions));


app.use(express.json())

app.use(cookieParser())



const saltRounds = 10;
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads'); // Specify the destination folder where uploaded f>
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname.replace(/\\/g, '/')); // Keep the original f>
  },
});
const uploads = multer({ storage: storage })

app.use('/uploads', express.static(__dirname + '/uploads'))


app.post('/verifyemail', async (req, res) => {
  const { email } = req.body;

  let digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < 4; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  const msg = {
  to: email, // Change to your recipient
  from: 'rzazadeelmir19@gmail.com', // Change to your verified sender
  subject: `${OTP} is your code!`,
  text: 'salam dostum',
  html: '<strong>techantgram💌</strong>',
}


   sgMail
  .send(msg)
  .then(async () => {

    const verifyData = await VerifyEmail.create({
      email,
      otpCode: OTP,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000
    })


    return res.status(201).json({
      msg: 'We sent code'
    })
  })
  .catch((err) => {
    return res.status(500).json({ err })
  })
})
app.post('/register', async (req, res) => {
  const { username, email, pass, code } = req.body;
  const UserDocU = await User.findOne({
    username: username
  })
  const UserDocE = await User.findOne({
    email: email
  })
  if (UserDocU) {
    return res.status(500).json({
      err: 'This username already exists'
    })
  }
  if (UserDocE) {
    return res.status(500).json({
      err: 'This email is already in use'
    })
  }
  const VerifyDoc = await VerifyEmail.findOne({
    email: email
  })
  if (!VerifyDoc) {
    return res.status(500).json({
      err: 'went wrong'
    })
  }
  if (VerifyDoc.otpCode === code) {
    if (VerifyDoc.expiresAt <= Date.now()) {
      await VerifyEmail.deleteOne({
        email: email
      })
      return res.status(500).json({
        err: 'Code expired!'
      })
    }
    const hashedPass = await bcrypt.hash(pass, saltRounds)
    const UserDoc = await User.create({
      username: username,
      email: email,
      password: hashedPass
    })    
    await VerifyEmail.deleteOne({
      email: email
    })


    if (UserDoc) {
      generateToken(res, UserDoc._id);
      return res.status(201).json({
        username: UserDoc.username,
        _id: UserDoc._id,
        profileImage: UserDoc.profileImage
      })
    }

  }


  return res.status(500).json({
    err: 'Code is wrong!'
  })


})

app.post('/login', async (req, res) => {
  console.log('hit login')
  const { username, pass } = req.body;
  const userDoc = await User.findOne({
    username: username
  });

  if (!userDoc) {
    return res.status(500).json({
      err: 'There is no such user!'
    })
  }

  const isSame = await bcrypt.compare(pass, userDoc.password)

  if (!isSame) {
    return res.status(500).json({
      err: 'Password is wrong!'
    })
  }

  generateToken(res, userDoc._id);
  return res.status(200).json({
    username: userDoc.username,
    _id: userDoc._id,
    profileImage: userDoc.profileImage
  })

})

app.get('/profile', protect, async (req, res) => {
  const UserData = {
    username: req.user.username,
    profileImage: req.user.profileImage,
    _id: req.user._id
  }
  return res.status(200).json(UserData)

})

app.put('/editprofile', protect, uploads.single("file"), async (req, res) => {
  let { username, bio } = req.body;
  // const { originalname, path } = req.file;
  const file = req.file;


  const previousUsername = req.user.username;
  const previousBio = req.user.bio;
  if (username == "") {
    username = previousUsername
  }
  if (bio == "") {
    bio = previousBio;
  }

  const hasThisUsername = await User.findOne({
    username: username
  })
  if (hasThisUsername && username != previousUsername) {
    return res.status(500).json({
      err: 'This username already exists'
    })
  }

  const userDoc = await User.findOne({
    username: previousUsername
  })
  userDoc.username = username;
  userDoc.bio = bio;
  // const previousImage = userDoc.profileImage;
  // fs.unlink(previousImage);
  if (file) {
    userDoc.profileImage = file.path;
  }
  await userDoc.save()

  return res.status(200).json({
    _id: userDoc._id,
    username: userDoc.username,
    profileImage: userDoc.profileImage
  })

})
app.get('/logout', protect, async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0)
  })
  return res.status(200).json({
    message: "User logged out"
  })
})

app.get('/myprofile', protect, async (req, res) => {


  // Create a user DTO with only the desired fields
  const userDto = {
    _id: req.user._id,
    username: req.user.username,
    profileImage: req.user.profileImage,
    isAdmin: req.user.isAdmin
  };
  res.status(200).json(userDto)
})

app.post('/createpost', protect, uploads.single("file"), async (req, res) => {
  const file = req.file;
  const { caption } = req.body;
  const postDoc = await Post.create({
    user: req.user._id,
    image: file.path,
    caption: caption
  })

  const userDoc = await User.findById(req.user._id);

  userDoc.posts.push(postDoc._id);

  await userDoc.save()

  return res.status(201).json({
    msg: 'Post Created!'
  })
})
app.get('/users/:id', protect, async (req, res) => {
  const id = req.params?.id;

  try {

    if (id === req.user._id) {
      const userWithPosts = await User.findById(id)
        .populate({
          path: 'posts',
          populate: [
            { path: 'user', select: 'username profileImage _id isAdmin' },
            { path: 'likes', select: 'username profileImage _id isAdmin' },
            { path: 'comments', select: 'text createdAt user', populate: { path: 'user', select: 'username profileImage _id isAdmin' }}
          ]
        })
        .populate('followers', 'username profileImage _id isAdmin')
        .populate('following', 'username profileImage _id isAdmin')


      // Create a user DTO with only the desired fields
        let newPosts = userWithPosts.posts.reverse();
  const userDto = {
        _id: userWithPosts._id,
        username: userWithPosts.username,
        profileImage: userWithPosts.profileImage,
        bio: userWithPosts.bio,
        posts: newPosts,
        followers: userWithPosts.followers,
        following: userWithPosts.following,
        isAdmin: userWithPosts.isAdmin
      };
      res.status(200).json(userDto);
    } else {
      const testUser = await User.findById(id);
      if (!testUser) {
        return res.status(404).json({ error: 'This account may be banned or deleted' });
      }
      const userWithPosts = await User.findById(id)
        .populate({
          path: 'posts',
          populate: [
            { path: 'user', select: 'username profileImage _id isAdmin' }, { path: 'likes', select: 'username profileImage _id isAdmin' },
            { path: 'comments', select: 'text createdAt user', populate: { path: 'user', select: 'username profileImage _id isAdmin' }}
          ]
        })
        .populate('followers', 'username profileImage _id isAdmin')
        .populate('following', 'username profileImage _id isAdmin')


      // Create a user DTO with only the desired fields
      const userDto = {
        _id: userWithPosts._id,
        username: userWithPosts.username,
        profileImage: userWithPosts.profileImage,
        bio: userWithPosts.bio,
        posts: userWithPosts.posts,
        followers: userWithPosts.followers,
        following: userWithPosts.following,
        isAdmin: userWithPosts.isAdmin
      };
      res.status(200).json(userDto);
    }
  } catch (error) {

    res.status(500).json({ error: 'Internal server error' });


  }
});
app.post('/follow/:id', protect, async (req, res) => {
  const currentUserId = req.user._id;
  const otherUserId = req.params.id;

  try {
    const currentUser = req.user;
    const otherUser = await User.findById(otherUserId);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if the current user is already following the other user
    if (currentUser.following.includes(otherUserId) || otherUser.followers.includes(currentUserId){
      return res.status(400).json({ error: 'Already following' });
    }

    // Add the other user to the current user's following array
    currentUser.following.push(otherUserId);
    await currentUser.save();

    // Add the current user to the other user's followers array
    otherUser.followers.push(currentUserId);
    await otherUser.save();

    const userWithFollowersAndFollowing = await User.findById(otherUser._id)
      .populate('followers', 'username profileImage _id isAdmin')
      .populate('following', 'username profileImage _id isAdmin');

    // Create a user DTO with only the followers and following fields
    const userDto = {
      followers: userWithFollowersAndFollowing.followers,
      following: userWithFollowersAndFollowing.following,
    };

    res.status(200).json(userDto);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.delete('/follow/:id', protect, async (req, res) => {
  const currentUserId = req.user._id;
  const otherUserId = req.params.id;

  try {
    const currentUser = req.user;
    const otherUser = await User.findById(otherUserId);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if the current user is not already following the other user or if the other u>
    if (!currentUser.following.includes(otherUserId) || !otherUser.followers.includes(currentUserId){
      return res.status(400).json({ error: 'Not following' });
    }

    // Remove the other user from the current user's following array
    currentUser.following.pull(otherUserId);
    await currentUser.save();

    // Remove the current user from the other user's followers array
    otherUser.followers.pull(currentUserId);
    await otherUser.save();

    const userWithFollowersAndFollowing = await User.findById(otherUser._id)
      .populate('followers', 'username profileImage _id isAdmin')
      .populate('following', 'username profileImage _id isAdmin');

    // Create a user DTO with only the followers and following fields
    const userDto = {
      followers: userWithFollowersAndFollowing.followers,
      following: userWithFollowersAndFollowing.following,
    };

    res.status(200).json(userDto);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/comment', protect, async (req, res) => {
  const { comment, postId } = req.body;
  const currentUserId = req.user._id;

  try {
    const postDoc = await Post.findById(postId);

    postDoc.comments.push({
      user: currentUserId,
      text: comment,
    });

    await postDoc.save();

    // Retrieve the updated post data with populated comments only
    const updatedPost = await Post.findById(postId).populate({
      path: 'comments',
      select: 'text createdAt user',
      populate: { path: 'user', select: 'username profileImage _id isAdmin' },
    });

    return res.status(201).json(updatedPost);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/like', protect, async (req, res) => {
  const { postId } = req.body;
  const currentUserId = req.user._id;
  const postDoc = await Post.findById(postId);
  postDoc.likes.push(currentUserId);

  await postDoc.save();

  // Retrieve the updated post data without populating the user field
  const updatedPost = await Post.findById(postId).populate({
    path: 'likes',
    select: 'username profileImage _id isAdmin',
  });

  return res.status(200).json(updatedPost);
});

app.delete('/like', protect, async (req, res) => {
  const { postId } = req.body;
  const currentUserId = req.user._id;
  const postDoc = await Post.findById(postId);
  postDoc.likes.pull(currentUserId);

  await postDoc.save()

  // Retrieve the updated post data without populating the user field
  const updatedPost = await Post.findById(postId).populate({
    path: 'likes',
    select: 'username profileImage _id isAdmin',
  });

  return res.status(200).json(updatedPost);
})
app.get('/posts', protect, async (req, res) => {
  const posts = await Post.find({ user: { $ne: req.user._id } }).populate({
    path: 'user',
    select: 'username profileImage _id isAdmin'
  }).populate({
    path: 'comments',
    select: 'text createdAt user',
    populate: { path: 'user', select: 'username profileImage _id isAdmin' },
  });

  return res.status(200).json(posts)
})

app.get('/allusers' ,protect, async (req,res) => {
  const authenticatedUserId = req.user._id;

  // Find all users except the authenticated user
  const otherUsers = await User.find({ _id: { $ne: authenticatedUserId } });

  // Create an array of user DTOs with only the desired fields
  const otherUsersDto = otherUsers.map((user) => ({
    _id: user._id,
    username: user.username,
    profileImage: user.profileImage,
    isAdmin:user.isAdmin
  }));

  res.status(200).json(otherUsersDto);
})

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_SECRET)
}


connectMongo()

server.listen(PORT, () => {
  console.log('Backend started!');
})



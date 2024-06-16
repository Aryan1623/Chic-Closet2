const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection with proper error handling and retry mechanism
const dbUri = process.env.MONGODB_URI || "mongodb+srv://aryanm3124:aWWDPdvXbR4khKML@cluster0.ywimhqt.mongodb.net/chic-closet";

const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  mongoose.connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
  });
};

connectWithRetry();

// Default route
app.get("/", (req, res) => {
  res.send("Express App is Running");
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './upload/images';
    fs.mkdirSync(dir, { recursive: true }); // Ensure directory exists
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });
app.use('/images', express.static('upload/images'));

// Image upload endpoint
app.post("/upload", upload.single('product'), (req, res) => {
  try {
    res.json({
      success: 1,
      image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Mongoose schema and model
const productSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  }
});

const Products = mongoose.model("Products", productSchema);

// Add product endpoint
app.post('/addproduct', async (req, res) => {
  try {
    const { name, image, category, new_price, old_price } = req.body;

    if (!name || !image || !category || !new_price || !old_price) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let products = await Products.find({});
    let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

    const product = new Products({
      id,
      name,
      image,
      category,
      new_price,
      old_price,
    });

    await product.save();
    res.json({
      success: true,
      name,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post('/removeproduct', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }
    
    const product = await Products.findOneAndDelete({ id });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    res.json({
      success: true,
      message: "Product removed successfully",
    });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get('/allproducts', async (req, res) => {
  try {
    let products = await Products.find({});
    console.log("All products fetched");
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  cartData: {
    type: Object,
    default: {},
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

const Users = mongoose.model('Users', userSchema);

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let check = await Users.findOne({ email });
    if (check) {
      return res.status(400).json({ success: false, message: "Existing user found with same email id" });
    }

    let cart = {};
    for (let i = 0; i < 300; i++) {
      cart[i] = 0;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = new Users({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      cartData: cart,
    });

    await user.save();

    const data = {
      user: {
        id: user._id,
      }
    };

    const token = jwt.sign(data, process.env.JWT_SECRET || 'secret_ecom'); // Use environment variable for secret
    res.json({ success: true, token });
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await Users.findOne({ email: req.body.email });
    if (user) {
      const passCompare = await bcrypt.compare(req.body.password, user.password);
      if (passCompare) {
        const data = {
          user: {
            id: user._id
          }
        };
        const token = jwt.sign(data, process.env.JWT_SECRET || 'secret_ecom'); // Use environment variable for secret
        res.json({ success: true, token });
      } else {
        res.status(400).json({ success: false, errors: "Wrong Password" });
      }
    } else {
      res.status(400).json({ success: false, errors: "Wrong Email Id" });
    }
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get('/newcollections', async (req, res) => {
  try {
    let products = await Products.find({});
    let newCollection = products.slice(-8);
    console.log("NewCollection fetched");
    res.json(newCollection);
  } catch (error) {
    console.error("Error fetching new collections:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get('/popularinwomen',async (req,res)=>{
  let products = await Products.find({category:"women"});
  let popular_in_women = products.slice(0,4);
  console.log("Popular in women fetched")
  res.send(popular_in_women);
})

const fetchUser = async (req,res,next) =>{
   const token = req.header('auth-token');
   if(!token){
    res.status(401).send({errors: "Please authenticate using valid token"})
   }
   else{
    try{
      const data = jwt.verify(token,'secret_ecom');
      req.user = data.user;
      next();
    }catch(error){
      res.status(401).send({errors: "please authenticate using a valid token"})
    }
   }
}

app.post('/addtocart',fetchUser,async (req,res)=>{
  console.log("added",req.body.itemId);
   let userData = await Users.findOne({_id:req.user.id})
   userData.cartData[req.body.itemId] += 1;
   await Users.findOneAndUpdate({_id: req.user.id},{cartData:userData.cartData})
   res.send("Added")
})

app.post('/removefromcart',fetchUser,async (req,res)=>{
  console.log("removed",req.body.itemId);
  
  let userData = await Users.findOne({_id:req.user.id})
  if(userData.cartData[req.body.itemId]>0)
  userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate({_id: req.user.id},{cartData:userData.cartData})
  res.send("Removed")
})

app.post('/getcart',fetchUser,async (req,res)=>{
console.log("GetCart");
let userData = await Users.findOne({_id:req.user.id});
res.json(userData.cartData);
})
// Start server
app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on port " + port);
  } else {
    console.log("Error: " + error);
  }
});






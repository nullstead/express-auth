const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('./config');
const flash = require('connect-flash');


const jwt = require('jsonwebtoken');
const JWT_SECRET = 'Mawunayrawo';
const nodemailer = require('nodemailer');


//email sending
var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "b475e44b48767a",
      pass: "260b8e91f9eaf5"
    }
  });

const port = 3000


const app = express();
app.set('view engine', 'ejs');
app.use(express.static('assets'))


//session store
const store = new MongoDBStore({
    uri: 'mongodb+srv://ncc:12345@cluster0.ahve76o.mongodb.net/logreg?retryWrites=true&w=majority&appName=Cluster0',
    collection: 'sessions'
})

store.on('error', function(error){
    console.log(error)
})

// Session middleware
app.use(session({
    secret: 'Akplenashortnam',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next){
    if(req.session.userId){
        return next()
    } else {
        return res.status(404).send('You need to log in first')
    }
}



app.use(express.json());
app.use(express.urlencoded({extended: false}))


app.get('/', (req, res) => {
    
    if(req.session.userId){
        res.redirect('/home')
    } else {
        res.render('login')
    }
})


app.get('/signup', (req, res) => {

    if(req.session.userId){
        res.redirect('/home')
    } else {
        res.render('signup')
    }

})

    //email verification
    function sendVerificationEmail(email, token) {
        const url = `http://localhost:3000/verify/${token}`;
        
        transport.sendMail({
            to: email,
            subject: 'Verify your email address',
            html: `Click <a href="${url}">here</a> to verify your email address.`,
        });
    }


    //send password reset email
    function sendPasswordResetEmail(user, token) {
        const url = `http://localhost:3000/newPassword/${token}`;
        
        transport.sendMail({
            to: user.email,
            subject: 'Password Reset',
            html: `Click <a href="${url}">here</a> to reset your password.`,
        });
    }


    // Request password reset get
    app.get('/resetPassword', async (req, res) => {
        return res.render('pwd-reset')
    })

    // Request password reset 
    app.post('/requestPasswordReset', async (req, res) => {
        const { email } = req.body;

        try {
            const user = await User.findOne({ email });

            if (!user) {
                return res.status(400).send('User not found');
            }

            // Generate reset token
            const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
            
            // Save token and expiration to user
            user.passwordResetToken = token;
            user.passwordResetExpires = Date.now() + 3600000; // 1 hour
            await user.save();

            // Send reset email
            sendPasswordResetEmail(user, token);
            // console.log('Password reset email sent')
            res.send('Password reset email sent');
        } catch (error) {
            res.status(500).send('Internal server error');
        }
    });

    // Password reset  get - new password
    app.get('/newPassword/:token', async (req, res) => {
        const { token } = req.params;

        return res.render('new-pwd', {token})
    })

    // Password reset  post
    app.post('/reset-password/:token', async (req, res) => {
        const { token } = req.params;
        const { password } = req.body;
        // console.log(token, password)

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findOne({
                _id: decoded.userId,
                passwordResetToken: token,
                passwordResetExpires: { $gt: Date.now() },
            });

            if (!user) {
                return res.status(400).send('Invalid or expired token');
            }

            // Update password
            user.password = await bcrypt.hash(password, 10);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            console.log('Password reset successful')
            res.redirect('/');
        } catch (error) {
            res.status(400).send('Invalid token');
        }
    });




//register user
app.post('/signup', async (req, res) => {


    const data = {
        email: req.body.email,
        password: req.body.password
    }


    //check if email already exists
    const existingUser = await User.findOne({email: data.email })

    if(existingUser){
        res.send('email already exists. Choose another!')
        return;
    } else {
        //hashpassword
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(data.password, saltRounds)
        data.password = hashedPassword
        //commit data to db
        const userData = await User.insertMany(data)
        // console.log(userData)
        
        // Generate verification token
        const token = jwt.sign({ userId: userData[0]._id }, JWT_SECRET, { expiresIn: '1d' });

        // Send verification email
        sendVerificationEmail(userData[0].email, token)
        console.log(userData[0].email)
        console.log(userData[0]._id)

        res.status(201).send('Registration successful. Check your email to verify your account.');
        // res.redirect('/')
        return;
    }

    
})  


// Verification route
app.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(400).send('Invalid token or user does not exist');
        }

        user.isVerified = true;
        await user.save();

        console.log('Email verified successfully');
        res.redirect('/')

    } catch (error) {
        res.status(400).send('Invalid token');
    }
});



//log user in
// app.post('/login', (req, res) => {

//     const check = User.findOne({email: req.body.email})
//     check.then((result) => {
//         console.log(result)
//     })
//     .catch((err) => {
//         console.log(err)
//     })
    
// })

app.post('/login', async (req, res) => {

    const {email, password} = req.body
    try {

        const check = await User.findOne({email: email})

        if(!check){
            res.status(401).send('Email can\'t be found!')
            console.log('no user')
            return;

        } else if (!check.isVerified) {
            console.log('Email not verified')
            return res.redirect('/');

        } else {
            console.log('user found')
            const passwordVerify = await bcrypt.compare(password, check.password)
            if(passwordVerify){
                // Store user ID in session
                req.session.userId = check._id
                req.session.email = check.email

                req.flash('success', 'Login successful!');
                res.redirect('/home')
                console.log('logged in!')
                return;
            }else {
                res.status(401).send('wrong password')
                console.log('wrong password')
                return;
            }
        }

    
    } catch(e) {
        res.status(500).send('Internal Server Error!')
        console.log(e)
    }

})


//logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) {
            // return res.status(500).send('Could not log out')
            res.json({message: 'could not log out'})
        } else {
            // res.send('Lougout Successful!')
            res.json({message: 'Lougout Successful!', redirect: '/'})
        }
    })
})


//protected route:home page
app.get('/home', isAuthenticated, (req, res) => {
    
    res.render('home', {email: req.session.email})
})




app.listen(port, () => {
    console.log(`Server running at: http://localhost:${port} `)
})


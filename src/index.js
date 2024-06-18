const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('./config')

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

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next){
    if(req.session.userId){
        return next()
    } else {
        res.status(404).send('You need to log in first')
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

//register user
app.post('/signup', async (req, res) => {

    const data = {
        username: req.body.username,
        password: req.body.password
    }


    //check if username already exists
    const existingUser = await User.findOne({username: data.username })

    if(existingUser){
        res.send('username already exists. Choose another!')
    } else {
        //hashpassword
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(data.password, saltRounds)
        data.password = hashedPassword
        //commit data to db
        const userData = await User.insertMany(data)
        console.log(userData)
        res.redirect('/')
    }

    
})  


//log user in
// app.post('/login', (req, res) => {

//     const check = User.findOne({username: req.body.username})
//     check.then((result) => {
//         console.log(result)
//     })
//     .catch((err) => {
//         console.log(err)
//     })
    
// })

app.post('/login', async (req, res) => {

    const {username, password} = req.body
    try {

        const check = await User.findOne({username: username})

        if(!check){
            res.status(401).send('Username can\'t be found!')
            console.log('no user')

        } else {
            console.log('user found')
            const passwordVerify = await bcrypt.compare(password, check.password)
            if(passwordVerify){
                // Store user ID in session
                req.session.userId = check._id
                req.session.username = check.username

                res.redirect('/home')
                console.log('logged in!')
            }else {
                res.status(401).send('wrong password')
                console.log('wrong password')
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
    res.render('home', {username: req.session.username})
})




app.listen(port, () => {
    console.log(`Server running at: http://localhost:${port} `)
})


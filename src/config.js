const mongoose = require('mongoose');
const dbURI = 'mongodb+srv://ncc:12345@cluster0.ahve76o.mongodb.net/logreg?retryWrites=true&w=majority&appName=Cluster0';
const connect = mongoose.connect(dbURI);

connect.then(() => {
    console.log("Database connected successfully!")
})
.catch(() => {
    console.log("Error connecting to DB")
})



//create a schema
const loginSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        }
    }, 
    {
        timestamps: true
    }
);

//collection part
const User = new mongoose.model('users', loginSchema)

module.exports = User
const mongoose  = require ('mongoose');
const bcrypt = require ('bcryptjs');
const crypto = require('crypto');
const moment = require('moment');

const Reservation = require('./reservation');

const Schema = mongoose.Schema;

// validate the user's email
// returns a boolean if the user email is in valid format or not
const validateEmail = function(email) {
    const re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return re.test(email)
};

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true,
        required: true,
        validate: [validateEmail, 'Please fill a valid email address'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    phoneNumber: {
        type: String
    },
    password: {
        type: String
    },
    address: {
        type: String
    },
    rewardsPoints: {
        type: Number,
        default: 0
    },
    profilePic: {
        type: String,
        default: "http://ssl.gstatic.com/accounts/ui/avatar_2x.png"
    },
    reservations: { 
        type: Array
    },
    google_id: {
        type: String
    },
    latest_reservation_created: {
        type: Number,
        default: 0
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

const User = module.exports = mongoose.model('User', userSchema);

// create a user function
// user will be created if the bcrypt.genSalt and bcrypt.hash functions are successful
module.exports.createUser = function(newUser, callBack){
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(newUser.password, salt, function(err, hash) {
            if (err) throw err;
            newUser.password = hash;
            newUser.save(callBack); 
        });
    });
}

module.exports.generateResetPasswordToken = function(email, callBack) {
    User.getUserByEmail(email, (err, user) => {
        if (err) return callBack(err);
        crypto.randomBytes(20, (err, buf) => {
            if (err) return callBack(err);
            var token = buf.toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = moment().add(1, 'h').toDate();
            user.save();
            return callBack(null, token);
        })
    })
}

module.exports.resetPassword = function (data, callBack) {
    const { token, password } = data;
    User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() }}, (err, user) => {
        if (err) return callBack(err);
        if (user) {
            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(password, salt, function(err, hash) {
                    console.log(hash)
                    if (err) return callBack(err);
                    user.password = hash;
                    user.save(callBack); 
                });
            });
        } else {
            callBack( new Error('no users found'));
        }
    })
}

// get a user query with an email
module.exports.getUserByEmail = function(email, callback) {
    const query = { email };
    User.findOne(query, callback);
}

// get the user with an id
module.exports.getUserById = function(id, callback) {
    User.findById(id, callback);
}


module.exports.comparePassword = function(candidatePassword, hash, callback) {
    bcrypt.compare(candidatePassword, hash, function(err, isMatch) {
        if (err) throw err;
        callback(null, isMatch);
    });
}

// maybe not needed
module.exports.addConnection = function(id, applicantID, exists, callback) {
    User.findById(id, function(err, user) {
        if (err) throw err;
        if (user.connections.includes(`${applicantID}`)){
            var error = "already connected";
            exists(error);
            return;
        } else {
            User.update({ _id : id },
                { $push : { connections:applicantID } },
                function( err, result ) {
                    if ( err ) throw err;
                    User.update({ _id: applicantID },
                        {$push: { connections: id } },
                    function(err, res) {
                        if (err) throw err
                        callback(null, res)
                    });
            });
        }
    });
}

// maybe not needed
module.exports.getReservations = function(id, callBack) {
    var reservations = []
    Reservation.findById(id, function(err, reservation) {
        if (err) throw err;
        var cursor = Reservations.find({ _id : { $in : reservation._id } }).cursor();
        cursor.on('data', function (reservation) {
            reservations.push(reservation)
        });
        cursor.on('close', function() {
            callBack(reservations);
          });
    });
}
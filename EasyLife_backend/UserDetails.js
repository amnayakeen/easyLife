const mongoose = require("mongoose");

const UserDetailsSchema = new mongoose.Schema({
    userId: String,
    name: String,
    email: { type: String, unique: true },
    password: String,
    tasks: { type: [String], default: [] },
    schedule: {
        workHours: {
            start: String,
            end: String,
        },
        bedTime: String,
        wakeUpTime: String,
        familyTime: String,
        meTime: String,
    },
    events: [
        {
            date: String,
            name: String,
            startTime: String,
            endTime: String,
            repeat: String,
        },
    ],
}, {
    collection: "UserInfo",
});

mongoose.model("UserInfo", UserDetailsSchema);

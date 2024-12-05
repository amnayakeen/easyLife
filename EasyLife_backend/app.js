const express = require("express");
const app = express();
const mongoose = require("mongoose");
app.use(express.json());
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const mongoUrl = "mongodb+srv://amnayakeen:aTlasadMin24!@cluster0.ehthxn2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const JWT_SECRET = "hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jdsds039[]]pou89ywe";

mongoose
    .connect(mongoUrl)
    .then(() => {
        console.log("Database Connected");
    })
    .catch((e) => {
        console.log(e);
    });

require('./UserDetails');

const User = mongoose.model("UserInfo");

app.get("/", (req, res) => {
    res.send({ status: "Started" });
});

// Register Endpoint
app.post('/register', async (req, res) => {
    const { name, email, password, schedule } = req.body;

    const oldUser = await User.findOne({ email: email });

    if (oldUser) {
        return res.send({ status: "user exists", data: "User already exists" });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await User.create({
            name: name,
            email: email,
            password: encryptedPassword,
            tasks: [],
            schedule: schedule,
        });

        // Ensure the `userId` (or `_id`) is sent in the response
        res.send({
            status: "Ok",
            data: {
                userId: newUser._id,
                token: jwt.sign({ email: newUser.email, userId: newUser._id }, JWT_SECRET),
            },
        });


    } catch (error) {
        res.send({ status: "error", data: error });
    }
});


// Login Endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const oldUser = await User.findOne({ email: email });

        // If the user doesn't exist
        if (!oldUser) {
            return res.send({ status: "user doesn't exist", data: "User doesn't exist" });
        }

        // Check if the password matches
        const isPasswordMatch = await bcrypt.compare(password, oldUser.password);

        if (!isPasswordMatch) {
            return res.send({ status: "passwords don't match", data: "Passwords don't match" });
        }

        // If password is correct, generate token
        const token = jwt.sign({ email: oldUser.email, userId: oldUser._id }, JWT_SECRET);

        // Include the `name` along with `token` and `userId`
        return res.send({
            status: "ok",
            data: {
                token: token,       // Return the JWT
                userId: oldUser._id, // Return the user ID
                name: oldUser.name   // Return the user's name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        // Return a generic error message if anything else goes wrong
        return res.send({ status: "error", data: "Unable to login" });
    }
});


app.post('/userSchedule', async (req, res) => {
    try {
        const { token, userId, schedule } = req.body;

        if (!token || !userId) {
            return res.status(400).json({ error: 'User ID and Token are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!schedule) {
            return res.status(400).json({ error: 'Schedule data is missing or invalid.' });
        }

        const { workHours, wakeUpTime, bedTime, familyTime, meTime } = schedule;

        // Helper to format time as HH:MM
        const formatTime = (time) => {
            if (!time) return '00:00';
            const [hours, minutes] = time.split(':').map(Number);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        };

        // Format input times
        const formattedWorkHours = {
            start: formatTime(workHours.start),
            end: formatTime(workHours.end),
        };
        const formattedWakeUpTime = formatTime(wakeUpTime);
        const formattedBedTime = formatTime(bedTime);
        const familyTimeInHours = parseFloat(familyTime);
        const meTimeInHours = parseFloat(meTime);

        // Validate numeric values
        if (isNaN(familyTimeInHours) || isNaN(meTimeInHours)) {
            return res.status(400).json({ error: 'Invalid family or me time format.' });
        }

        user.schedule = {
            workHours: formattedWorkHours,
            wakeUpTime: formattedWakeUpTime,
            bedTime: formattedBedTime,
            familyTime: familyTimeInHours,
            meTime: meTimeInHours,
        };

        await user.save();

        res.send({ status: "Ok", data: user.schedule });
    } catch (error) {
        console.error('Error while saving schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/userdata', async (req, res) => {
    const { token, userId, schedule } = req.body;

    try {
        const user = jwt.verify(token, JWT_SECRET);

        if (user.userId !== userId) {
            return res.send({ status: "error", data: "Unauthorized" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { schedule },
            { new: true }
        );

        res.send({ status: "Ok", data: updatedUser });
    } catch (error) {
        console.error('UserData error:', error);
        res.send({ status: "error", data: "Unable to save data" });
    }
});


// Add Task Endpoint
app.post("/tasks", async (req, res) => {
    try {
        const { userId, taskDescription } = req.body;

        // Find the user and add a task
        const user = await User.findById(userId);
        if (!user) return res.status(404).send({ message: "User not found" });

        user.tasks.push({ taskId: uuidv4(), description: taskDescription });
        await user.save();

        res.send({ message: "Task added successfully" });
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            res.status(400).send({ message: error.message });
        } else {
            console.error("Error adding task:", error);
            res.status(500).send({ message: "Server error" });
        }
    }
});


// Get Tasks Endpoint
app.get("/tasks", async (req, res) => {
    const { userId } = req.query;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.send({ status: "user not found", data: "User not found" });
        }

        // Return the tasks array for the user
        res.send({ status: "Ok", data: user.tasks });
    } catch (error) {
        console.error(error);
        res.send({ status: "error", data: "Error fetching tasks" });
    }
});

// Share Task Endpoint
app.post("/share", async (req, res) => {
    const { email, task } = req.body;

    try {
        // Find the user by email
        const oldUser = await User.findOne({ email: email });
        if (!oldUser) {
            return res.send({ status: "user not found", data: "User not found" });
        }

        // Add the task to the user's task list
        oldUser.tasks.push(task);
        await oldUser.save()

        res.send({
            status: "yes",
            data: {      // Return the JWT
                userId: oldUser._id, // Return the user ID
                email: oldUser.email   // Return the user's name
            }
        });



    } catch (error) {
        console.error(error);
        res.send({ status: "error", data: "Error sharing task" });
    }
});

app.post('/saveEvent', async (req, res) => {
    const { userId, token, event } = req.body;

    try {
        const user = jwt.verify(token, JWT_SECRET);

        if (user.userId !== userId) {
            return res.status(401).json({ status: "error", data: "Unauthorized" });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ status: "error", data: "User not found" });
        }

        userData.events.push(event); // Add the event to the user's events
        await userData.save();

        res.json({ status: "Ok", data: userData.events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", data: "Unable to save event" });
    }
});


app.get('/getEvents', async (req, res) => {
    const { userId } = req.query;

    try {
        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ status: "error", data: "User not found" });
        }

        res.json({ status: "Ok", data: userData.events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", data: "Unable to fetch events" });
    }
});


// Start the server
app.listen(8082, () => {
    console.log("Node.js has started");
});

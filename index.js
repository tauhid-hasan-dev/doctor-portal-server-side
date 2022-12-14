const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const cors = require('cors');
const app = express();
require('dotenv').config();
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jjvuikj.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send("Unauthorized Access")
    }
    const token = authHeader.split(' ')[1];
    //console.log(token);
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return err.status(403).send('Forbidden Access')
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions');
        const bookingsCollection = client.db('doctorsPortal').collection('bookings');
        const usersCollection = client.db('doctorsPortal').collection('users');
        const doctorsCollection = client.db('doctorsPortal').collection('doctors');
        const paymentsCollection = client.db('doctorsPortal').collection('payments');

        //make sure you verifyAdmin after verifyJwt
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.send.status(403).send({ message: 'Forbidden Access' })
            }
            next();
        }



        //use aggregate to query multilple collection and then merge data
        app.get('/appoinmentoptions', async (req, res) => {
            //getting the the booking date
            const date = req.query.date;
            //console.log(date);
            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray();
            //finding the bookings for the provided date
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            //console.log(alreadyBooked)
            //finding the booking for from all treatments in that certaindates
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatmentName === option.name)
                const bookedSlot = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlot.includes(slot));
                option.slots = remainingSlots;
                //console.log(date, option.name, remainingSlots.length);
            })
            res.send(options)
        })

        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {};
            const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray();
            res.send(result)
        })

        app.get('/bookings', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send('Forbidden Access')
            }

            /* console.log('this', email) */
            const query = { email: email };
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingsCollection.findOne(query);
            res.send(booking);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatmentName: booking.treatmentName
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You already have booking on ${booking.appointmentDate}`;
                return res.send({ acknowledged: false, message })
            }
            console.log(booking)
            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })


        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const query = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updateBooking = await bookingsCollection.updateOne(query, updatedDoc)
            res.send(result);
        })


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
                return res.send({ accessToken: token });
            }
            console.log(user)
            res.status(403).send({ accessToken: '' });
        })


        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })


        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            /*    console.log(user); */
            const result = await usersCollection.insertOne(user);
            res.send(result)
        });


        app.put('/users/admin/:id', verifyJwt, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })

        //temporary api for injecting data
        /*  app.get('/addprice', async (req, res) => {
             const filter = {};
             const options = { upsert: true };
             const updateDoc = {
                 $set: {
                     price: 99
                 },
             };
             const result = await appointmentOptionsCollection.updateMany(filter, updateDoc, options);
             res.send(result)
         }) */

        app.get('/doctors', verifyJwt, verifyAdmin, async (req, res) => {
            const query = {};
            const doctors = await doctorsCollection.find(query).toArray();
            res.send(doctors);
        })

        app.post('/doctors', verifyJwt, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        });

        app.delete('/doctors/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        })



        /**
         * API naming conventions
         * ===========================
         app.get('/bookings');
         app.get('/bookings/:id');
         app.post('/bookings')
         app.delete('/bookings/:id)
         app.patch('/bookings/:id)
         */


    } finally {

    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Doctors portal server is running');
})

app.listen(port, () => {
    console.log(`Doctors portal is running on ${port}`);
})
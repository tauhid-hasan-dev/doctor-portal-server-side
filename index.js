const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');

const cors = require('cors');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jjvuikj.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions');
        const bookingsCollection = client.db('doctorsPortal').collection('bookings');
        const usersCollection = client.db('doctorsPortal').collection('users');



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

        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            console.log('this', email)
            const query = { email: email };
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
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


        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result)
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
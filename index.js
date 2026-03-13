const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const port = process.env.PORT || 5000
const crypto = require("crypto");

const admin = require("firebase-admin");

const serviceAccount = require("./zap-shift-f4d73-firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Middleware
app.use(express.json())
app.use(cors())
const verifyFBToken = async(req,res,next)=>{

  // console.log('headers in the Middleware',req.headers?.authorization);
  const token = req.headers.authorization;

  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }

  try{
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log('decoded in the token', decoded);
    req.decoded_email = decoded.email;
    next();
  }
  catch(err){
    return res.status(401).send({message: 'unauthorized access'})
  }

  
}

// Generate Tracking ID
function generateTrackingId() {
  return 'TRK-' + Math.floor(100000 + Math.random() * 900000)
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8v42xkx.mongodb.net/?appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    await client.connect()
    console.log('MongoDB connected ✅')

    const db = client.db('zap_shift_db')
    const userCollection = db.collection('users');
    const parcelsCollection = db.collection('parcels')
    const paymentsCollection = db.collection('payments')
    const ridersCollection = db.collection('riders')

    // users related api
    app.post('/users',async(req, res)=>{
      const user = req.body;
      user.role = 'user';
      user.createdAt = new Date();

      const email = user.email;
      const userExists = await userCollection.findOne({email})

      if(userExists){
        return res.send({message: 'user exists'})
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    })

app.get('/users', verifyFBToken, async(req, res) => {

  const result = await userCollection.find().toArray();
  res.send(result);

})

app.patch('/users/:id', verifyFBToken, async(req, res) => {

  const id = req.params.id;
  const roleInfo = req.body;

  const query = { _id: new ObjectId(id) }

  const updateDoc = {
    $set: {
      role: roleInfo.role
    }
  }

  const result = await userCollection.updateOne(query, updateDoc)

  res.send(result)

})

    // ==============================
    // PARCEL ROUTES
    // ==============================

    // Get parcels
    app.get('/parcels', async (req, res) => {
      try {
        const query = {}

        if (req.query.email) {
          query.senderEmail = req.query.email
        }

        const result = await parcelsCollection.find(query).toArray()
        res.send(result)

      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch parcels' })
      }
    })


    // Get single parcel
    app.get('/parcels/:id', async (req, res) => {
      try {

        const result = await parcelsCollection.findOne({
          _id: new ObjectId(req.params.id)
        })

        res.send(result)

      } catch (error) {
        res.status(400).send({ error: 'Invalid parcel ID' })
      }
    })


    // Create parcel
    app.post('/parcels', async (req, res) => {
      try {

        const parcel = req.body

        parcel.createdAt = new Date()
        parcel.paymentStatus = 'pending'

        const result = await parcelsCollection.insertOne(parcel)

        res.send(result)

      } catch (error) {
        res.status(500).send({ error: 'Failed to create parcel' })
      }
    })


    // Delete parcel
    app.delete('/parcels/:id', async (req, res) => {
      try {

        const result = await parcelsCollection.deleteOne({
          _id: new ObjectId(req.params.id)
        })

        res.send(result)

      } catch (error) {
        res.status(400).send({ error: 'Invalid parcel ID' })
      }
    })


    // ==============================
    // STRIPE CHECKOUT SESSION
    // ==============================

    app.post('/create-checkout-session', async (req, res) => {
      try {

        const { cost, parcelId, senderEmail, parcelName } = req.body

        if (!cost || !parcelId || !senderEmail) {
          return res.status(400).send({
            error: 'Missing required fields'
          })
        }

        const amount = Math.round(Number(cost) * 100)

        const session = await stripe.checkout.sessions.create({

          payment_method_types: ['card'],

          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: amount,
                product_data: {
                  name: parcelName || 'Parcel Payment',
                },
              },
              quantity: 1,
            },
          ],

          mode: 'payment',

          customer_email: senderEmail,

          metadata: {
            parcelId,
            parcelName,
          },

          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        })

        res.send({ url: session.url })

      } catch (error) {
        console.error(error)
        res.status(500).send({ error: 'Stripe session creation failed' })
      }
    })


    // ==============================
    // PAYMENT SUCCESS VERIFY
    // ==============================

app.patch('/payment-success', async (req, res) => {

  try {

    const sessionId = req.query.session_id

    if (!sessionId) {
      return res.status(400).send({
        error: 'Session ID missing'
      })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return res.status(400).send({
        success: false,
        message: 'Payment not completed',
      })
    }

    const parcelId = session.metadata.parcelId
    const transactionId = session.payment_intent

    // Check if payment already exists
    const paymentExist = await paymentsCollection.findOne({ transactionId })

    if (paymentExist) {
      return res.send({
        success: true,
        message: 'Payment already processed',
        transactionId: paymentExist.transactionId,
        trackingId: paymentExist.trackingId
      })
    }

    // Generate tracking id
    const trackingId = generateTrackingId()

    // Update parcel
    const updateResult = await parcelsCollection.updateOne(
      { _id: new ObjectId(parcelId) },
      {
        $set: {
          paymentStatus: 'paid',
          transactionId,
          trackingId,
          paidAt: new Date(),
        },
      }
    )

    // Save payment
    const paymentDoc = {
      amount: session.amount_total / 100,
      currency: session.currency,
      customerEmail: session.customer_email,
      parcelId,
      parcelName: session.metadata.parcelName,
      transactionId,
      trackingId,
      paymentStatus: session.payment_status,
      paidAt: new Date(),
    }

    const paymentResult = await paymentsCollection.insertOne(paymentDoc)

    res.send({
      success: true,
      transactionId,
      trackingId,
      parcelUpdated: updateResult.modifiedCount > 0,
      paymentSaved: paymentResult.insertedId,
    })

  } catch (error) {
    console.error(error)
    res.status(500).send({ success: false })
  }
})

    // payment related api
    app.get('/payments',verifyFBToken,async(req,res)=>{
      const email = req.query.email;
      const query = {}

      // console.log(req.headers);

      if(email){
        query.customerEmail=email;

        // check email address
        if(email !== req.decoded_email){
          return res.status(403).send({message: 'forbidden access'});
        }
      }
      const cursor = paymentsCollection.find(query).sort({paidAt: -1});
      const result = await cursor.toArray();
      res.send(result);
    })

    // riders related api

    app.get('/riders',async(req,res)=>{
      const query = {}
      if(req.query.status){
        query.status = req.query.status;
      }
      const cursor = ridersCollection.find(query)
      const result = await cursor.toArray();
      res.send(result);
    })


    app.post('/riders',async(req,res)=>{
      const rider = req.body;
      rider.status = 'pending';
      rider.createdAt = new Date();

      const result = await ridersCollection.insertOne(rider);
      res.send(result);
    })

app.patch('/riders/:id', verifyFBToken, async (req, res) => {
  try {
    const status = req.body.status;
    const id = req.params.id;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status: status } };

    const result = await ridersCollection.updateOne(filter, updateDoc);

    if(status === 'approved'){
      const email = req.body.email;
      const userQuery = {email}
      const updateUser = {
        $set:{
          role: 'rider'
        }
      }
      const userResult = await userCollection.updateOne(userQuery,updateUser);
    }

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to update rider status', error: error.message });
  }
});

    await client.db('admin').command({ ping: 1 })
    console.log("MongoDB ping success ✅")

  } finally {
  }
}

run().catch(console.dir)


// Root Route
app.get('/', (req, res) => {
  res.send('Zap Shift Server Running 🚀')
})


app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
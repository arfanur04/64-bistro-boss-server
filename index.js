const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zxotz8q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

const logger = (req, res, next) => {
	try {
		console.log("log info: ", req.method, req.url);
		next();
	} catch (error) {
		console.error("error: ", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
};

const verifyToken = (req, res, next) => {
	try {
		// console.log(req.headers);
		if (!req.headers.authorization) {
			return res.status(401).send({ message: "unauthorized access" });
		}
		const token = req.headers.authorization.split(" ")[1];
		jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
			if (err) {
				return res.status(401).send({ message: "unauthorized access" });
			}
			req.decoded = decoded;
			next();
		});
	} catch (error) {
		console.error("error: ", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
};

// use after verifyToken
const verifyQueryEmail = (req, res, next) => {
	try {
		if (req.query.email !== req.decoded.email) {
			return res.status(403).send({ message: "forbidden access" });
		}
		next();
	} catch (error) {
		console.error("error: ", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
};

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();

		const database = client.db("bistroDb");
		//
		const userCollection = database.collection("users");
		const menuCollection = database.collection("menu");
		const reviewsCollection = database.collection("reviews");
		const cartCollection = database.collection("carts");

		//: middleware
		// use after verifyToken
		const verifyAdmin = async (req, res, next) => {
			try {
				const email = req.decoded.email;
				const query = { email };
				const user = await userCollection.findOne(query);
				const isAdmin = user?.role === "admin";
				if (!isAdmin) {
					return res.status(403).send({ message: "forbidden access" });
				}
				next();
			} catch (error) {
				console.error("error: ", error);
				return res.status(500).send({ message: "Internal Server Error" });
			}
		};

		// jwt related api
		app.post("/jwt", logger, async (req, res) => {
			try {
				const user = req.body;
				const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
					expiresIn: "1h",
				});
				res.send({ token });
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// check isAdmin
		app.get("/users/admin/:email", logger, verifyToken, async (req, res) => {
			try {
				const email = req.params.email;
				if (email !== req.decoded.email) {
					return res.status(403).send({ message: "forbidden access" });
				}
				const query = { email };
				const user = await userCollection.findOne(query);
				let admin = false;
				if (user) {
					admin = user?.role === "admin";
				}
				res.send({ admin });
			} catch (error) {
				console.error("error: ", error);
				return res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.get("/users", logger, verifyToken, verifyAdmin, async (req, res) => {
			try {
				const result = await userCollection.find().toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.post("/users", logger, async (req, res) => {
			try {
				const user = req.body;
				// insert email if user doesn't exist.
				// you can do this many ways (1. email_unique, 2. upsert, 3. simple checking)
				const filter = { email: user.email };
				const existingUser = await userCollection.findOne(filter);
				if (existingUser) {
					const update = {
						$set: {
							updatedAt: user.updatedAt,
							updatedLocal: user.updatedLocal,
						},
					};
					const result = await userCollection.updateOne(filter, update);
					return res.send([
						{
							message: "User already exists",
							insertedId: null,
						},
						result,
					]);
				}
				res.send(await userCollection.insertOne(user));
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.patch(
			"/users/admin/:id",
			logger,
			verifyToken,
			verifyAdmin,
			async (req, res) => {
				try {
					const id = req.params.id;
					const filter = { _id: new ObjectId(id) };
					const update = {
						$set: {
							role: "admin",
							roleUpdated: new Date().toISOString(),
						},
					};
					const result = await userCollection.updateOne(filter, update);
					res.send(result);
				} catch (error) {
					console.error("error: ", error);
					res.status(500).send({ message: "Internal Server Error" });
				}
			}
		);

		app.delete(
			"/users/:id",
			logger,
			verifyToken,
			verifyAdmin,
			async (req, res) => {
				try {
					const id = req.params.id;
					const query = { _id: new ObjectId(id) };
					const result = await userCollection.deleteOne(query);
					res.send(result);
				} catch (error) {
					console.error("error: ", error);
					res.status(500).send({ message: "Internal Server Error" });
				}
			}
		);

		app.get("/menu", logger, async (req, res) => {
			try {
				const result = await menuCollection.find().toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.get("/reviews", logger, async (req, res) => {
			try {
				const result = await reviewsCollection.find().toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.get("/carts", logger, async (req, res) => {
			try {
				const email = req.query.email;
				const query = { email };
				const result = await cartCollection.find(query).toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.post("/carts", logger, async (req, res) => {
			try {
				const cartItem = req.body;
				const result = await cartCollection.insertOne(cartItem);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.delete("/carts/:id", logger, async (req, res) => {
			try {
				const id = req.params.id;
				const query = { _id: new ObjectId(id) };
				const result = await cartCollection.deleteOne(query);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.get("/m", logger, async (req, res) => {
			try {
				//: get
				if (req.query.c) {
					const collectionName = database.collection(req.query.c);
					res.send(await collectionName.find().toArray());
				}
				//: delete
				// else if (req.query.d) {
				// 	const collectionName = database.collection(req.query.d);
				// 	res.send(await collectionName.deleteMany({}));
				// }
				//: post
				// const doc2 = array of object;
				// else if (req.query.p) {
				// 	const collectionName = database.collection(req.query.p);
				// 	res.send(await collectionName.insertMany(doc2, { ordered: true }));
				// }
				//
				else {
					res.send({ message: "else" });
				}
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// Send a ping to confirm a successful connection
		// await client.db("admin").command({ ping: 1 });

		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Server is running");
});

app.listen(port, () => {
	console.log(`Server is listening on port ${port}`);
});

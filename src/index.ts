import "reflect-metadata";
import { MyContext } from "./types";
import {MikroORM} from "@mikro-orm/core";
import express from "express";
import {COOKIE_NAME, __prod__} from "./constants";
// import {Post} from "./entities/Post";
import microConfig from "./mikro-orm.config"; 
import {ApolloServer} from 'apollo-server-express';
import {buildSchema} from "type-graphql";
import {HelloResolver} from "./resolvers/hello";
import {PostResolver} from "./resolvers/post"
import { UserResolver } from "./resolvers/user";
// import * as redis from "redis";
let redis = require("redis")
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from "cors"

/*
session: its like a middleware ?
RedisStore: idk what the fuck is this
redisClient: its just how you interact with RedisDB
*/
const main = async () => {
    const orm = await MikroORM.init(microConfig);
    await orm.getMigrator().up();

    const app = express();

    const RedisStore = connectRedis(session);
    const redisClient = redis.createClient();

    //why does this not work ? 
    redisClient.on('connection', () => {
        console.log("connection established")
    })

    app.use(
        cors({
            origin: "http://localhost:3000",
            credentials: true
        })
    )

    app.use(
        session({
            name:COOKIE_NAME,
            store: new RedisStore({ 
                client: redisClient,
                disableTouch: true,
            }),
            cookie: {
                maxAge: 1000 * 60 * 60, // one hour
                httpOnly: true,
                sameSite:'lax', //csrf
                secure: __prod__ , // Cookie only works in https
            },
            saveUninitialized: false,
            secret: 'keyboard penis',
            resave: false,
        })
    )

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false
        }),
        //this is where em was initialized.
        context: ({req, res}): MyContext => ({em: orm.em, req, res}),
    });

    app.get('/', (_, res) => {
        res.send('hello');
    })
    
    await apolloServer.start()
    // Apollo server initiates a middelware on app, which is express, 
    // and the middleware will find the context in the apolloServer
    // So how did shenlearn handle its middleware in the past ?

    apolloServer.applyMiddleware({ 
        app,
        cors: false 
     })
    
    app.listen(4000, () => {
        // console.log(redisClient.CLIENT_INFO)
        console.log('server started on localhost:4000');
    });

}

main().catch(err => {
    console.error(err);
}); 

console.log("Hello boys");
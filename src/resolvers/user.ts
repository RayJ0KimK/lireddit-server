import { MyContext } from "../types";
import {Arg, Ctx, Resolver, InputType, ObjectType, Field, Mutation, Query} from "type-graphql";
import {User} from "../entities/User";
import argon2 from 'argon2';
import {EntityManager} from '@mikro-orm/postgresql';
import { COOKIE_NAME } from "../constants";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()
class FieldError{
    @Field()
    field: string;
    
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError [];

    @Field(() => User, {nullable: true})
    user?: User;
    
}

@Resolver()
export class UserResolver{
    @Query(() => User, {nullable: true})
    async me( @Ctx() {req, em} : MyContext){
        if(!req.session.userId){
            return null; 
        }
        const user = await em.findOne(User, {id: req.session.userId});
        return user; 
    }

    @Query(() => [User])
    async users( @Ctx() {em}: MyContext): Promise<User[]> {
        return await em.find(User, {});
    }

    //The thing inside the parenthesis is some type of config of this operation
    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx(){em, req}: MyContext
    ){  

        if(options.username.length <= 2){
            return {
                errors : 
                [
                    {
                        field: 'username',
                        message: 'length must be greater than 2'
                    }
                ]
            }
        }

        if(options.password.length <= 2){
            return {
                errors: 
                [
                    {
                        field: 'password',
                        message:"length must be greater than 2"
                    }
                ]
            }
        }

        const hasedPassword = await argon2.hash(options.password);
        // const user = em.create(User, {
        //     username: options.username, 
        //     password: hasedPassword
        // });
        let user;
        try{
            const [result] = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert(
                {
                    username: options.username, 
                    password: hasedPassword, 
                    created_at: new Date(),
                    updated_at: new Date(), 
                }
            ).returning('*')
            user = result
        }catch(err){
            console.log(err);
            if(err.code === "23505"){
                return {
                    errors: [
                        {
                            field: "username",
                            message: "username already taken"
                        }
                    ]
                }
            }
        }
        // store user id Session
        // this will set a cookie on the user
        // keep them logged in
        req.session.userId = user.id;
        return {user} ;
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx(){em, req}: MyContext
    ): Promise<UserResponse> {

        if (options.username.length <= 2){
            return {
                errors: [
                    {
                        field: 'username',
                        message : "length must be greater thant  2"
                    }
                ]
            }
        }

        const user = await em.findOne(User, {username: options.username});
        if (!user) {
            return {
                errors: [
                    {
                        field: 'username',
                        message: "That username doesn't exists",
                    },
                ]
            };
        }
        const valid = await argon2.verify(user.password, options.password);
        if (!valid) {
            return {
                errors: [
                    {
                        field: 'password',
                        message: "incorrect password",
                    },
                ]
            };
        }
        console.log(JSON.stringify(req.session))
        req.session.userId = user.id;

        return {user};
    }

    @Mutation(() => Boolean)
    logout(
        @Ctx() {req, res}: MyContext
    ){
        return new Promise((resolve) => 
            req.session.destroy((err) => {
                res.clearCookie(COOKIE_NAME)
                if(err){
                    console.log(err);
                    resolve(false);
                    return;
                }
                resolve(true)
            }))
    }
}
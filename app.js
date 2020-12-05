//require modules
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// connect to/create (if does not already exist) todolistDB database
// Commented out is the local address needed to connect to a local instance of your mongoDB server. In this app we're connecting ot the cloud, so we're using the second address listed below
// mongoose.connect("mongodb://localhost:27017/todolistDB", {useNewUrlParser: true,useUnifiedTopology: true})
mongoose.connect("mongodb+srv://admin-harsh:test123@cluster0.ldyey.mongodb.net/todolistDB", {useNewUrlParser: true,useUnifiedTopology: true})

// create schema for todo list items
const itemsSchema = {
  name: String
}

// create Item model, which follows above schema, for those inputs. Creates the `items` collection in your todolistDB Databse
const Item = mongoose.model("Item", itemsSchema)

// create schema for new lists. Each has a name, and an array of items which each follow the itemsSchema
const listSchema = {
  name: String,
  items: [itemsSchema]
};

// create the List model, which follows the above schema, for those inputs. Creates the `lists` collection in your todolistDB Databse
const List = mongoose.model("List", listSchema);


// create default items
const item1 = new Item({ name: "Default Item 1"})
const item2 = new Item({ name: "Default Item 2"})
const item3 = new Item({ name: "Default Item 3"})
const defaultItems = [item1, item2, item3];


// instructions for get request to root route
app.get("/", function(req, res) {
  Item.find({}, function(err, foundItems) {                                   // return all documents in the `items` collection to 'foundItems'
    if (foundItems.length === 0) {                                            // If no documents in the collection
      Item.insertMany(defaultItems, function(err) {                           // Insert the default items into it
        if (err) {
          console.log(err)
        } else {
          console.log("Successfully saved items to DB!")
        }
      })
      res.redirect("/");                                                      // reload the get request for the root page (to display these new items in the list) -> so basically, every time you load the website for the first time, it'll follow this path in the code and finish here until further action
    } else {
      res.render("list", {listTitle: "Today", newListItems: foundItems});     // If there are already documents in the collection, then render the list.ejs file, passing the title "Today" along with the data in `foundItems`
    }
  })
});


//instructions for get request to all custom directories
app.get("/:customListName", function(req, res) {
  // get name of the extension they typed into the address bar
  // also make sure any capitalization style in the address bar will route you to the same page
  const customListName = _.capitalize(req.params.customListName);

  List.findOne({name: customListName}, function(err, foundList){              // Search the lists collection for a document with the name of the extension they typed in
    if (!err) {
      if(!foundList){                                                         // If the list doesn't yet exist, create it using the Capitalized title provided in the URL, and the default items as the initial lists items
        const list = new List({
          name: customListName,
          items: defaultItems
        })
        list.save()                                                           // Save this list as a document in the lists collection
        res.redirect("/" + customListName)                                    // reload the get request for this custom URL now that the respective list has been created
      } else {
        res.render("list", {listTitle: foundList.name, newListItems: foundList.items})  // If the URL title already exists, then load that page
      }
    }
  })
})

// instructions for post requests to root route (this is when people try to add a new item to a todo list)
// could be the home todo list or a custom todo list
app.post("/", function(req, res) {
  // Get the item and associated list title submitted on the form by the user
  const itemName = req.body.newItem;
  const listName = req.body.list_name;

  // save the item data recieved from the form as a document for Mongo
  const item = new Item({
    name: itemName
  })
  // if the new item was inputted on the home todo list, add it to the items collection in our MongoDB server, then reload the page to display the new item
  if (listName === "Today"){
    item.save();
    res.redirect("/")
    // If item was inputted on a different todo list, find the corresponding document in the lists collection in our DB, and add the item on to the end of the array of items for that document.
    // Then save that updated document to our Mongo Database and redirect to the same page so that the updated item is shown on the screen. (Redirects to /:customListName)
    // Remember that our DB is set up such that data on the home todo list is stored in `items` but data on other todo lists are stored in `lists`. The data in `items` is one document for each todo list item. The data in `lists` is one document for each array (each array has a title of the list and then the actual todo list items.)
  } else {
    List.findOne({name: listName}, function(err, foundList){
      foundList.items.push(item);
      foundList.save();
      res.redirect("/" + listName)
    })
  }
});

// instructions for a post request to the /delete route
app.post("/delete", function(req,res){
  // get the mongo _id of the item being deleted and the title of the todo list in question
  const checkedItemId = req.body.check_box;
  const listName = req.body.checkbox_list_name;
  // if an item in the root todo list, then remove the document from the `items` colelction by _id
  if (listName === "Today"){
    Item.findByIdAndRemove(checkedItemId, function(err){
      if (err) {
        console.log(err)
      } else {
        console.log("Successfully deleted checked item.")
        res.redirect("/");
      }
    })
    // if an item in a custom todo list, then find the correct document within the `lists` collection and remove the correct item from the array by _id.
    // Then redirect to the same page so that the updated todo list can be seen
    // Because of how our `lists` collection is different from our `items` collection, we're not acutally removing a document here. We're removing an element inside of a document.
    // We're using $pull, which is a MongoDB specific operator
    // The findOneAndUpdate() method must have a callback function specified to function, even if that callback is trivial, as in this case
  } else {
    List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedItemId}}}, function(err, foundList){
      if (err){
        console.log(err)
      } else {
        res.redirect("/" + listName);
      }
    })}
})

// enable heroku port functionality and local funcitonality if you decide to run your server locally
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server started successfully.");
})

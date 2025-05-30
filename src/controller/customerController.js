import {
  getApprovedProducts,
  getProducts,
} from "../services/productServices.js";
import {
  addItem,
  changeProductAmount,
  deleteItem,
  getCart,
  removeCompleteItem,
} from "../services/cartServices.js";
import { getUserById } from "../services/userServices.js";
import {
  bookWorkshop,
  getWorkshopByUserId,
} from "../services/workshopServices.js";

import cloudinary from "../config/cloudinary.js";
import { addRequest, getRequestById } from "../services/requestServices.js";
import {
  getOrderByOrderId,
  getOrdersById,
  placeOrder,
} from "../services/orderServices.js";
const custrole = "customer";

export const getHomePage = async (req, res) => {
  const products = await getProducts(null, true);
  const pro = products.slice(0, 10);
  const userId = req.user.id;
  const customerOrders = await getOrdersById(userId);
  // Debug log removed: console.log(customerOrders, userId);
  const customerRequests = await getRequestById(userId);
  const customerWorkshops = await getWorkshopByUserId(userId);
  res.render("customer/customerhome", {
    role: custrole,
    products: pro,
    requests: customerRequests,
    orders: customerOrders,
    workshops: customerWorkshops,
    userId,
  });
};

export const getOrdersPageCustomer = async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.orderId;

  const order = await getOrderByOrderId(orderId);

  if (!order) {
    return res.status(404).send("Order not found");
  }

  res.render("customer/orderDetails", {
    role: custrole,
    order: order,
  });
};

export const getStorePage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.query;
    const products = await getApprovedProducts(category);

    const page = parseInt(req.query.page) || 1;
    const limit = 12;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedProducts = products.slice(startIndex, endIndex);

    res.render("customer/store", {
      products: paginatedProducts,
      currentPage: page,
      totalPages: Math.ceil(products.length / limit),
      role: custrole,
      userId,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

export const addToCart = async (req, res) => {
  const { userId, productId } = req.query;
  try {
    res.json(await addItem(userId, productId));
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//Orders

export const getCartController = async (req, res) => {
  const userId = req.user.id;
  const cart = await getCart(userId);

  let amount = 0;
  for (const item of cart) {
    amount += item.quantity * item.productId.newPrice;
  }

  // Check if this is a summary-only request (for quantity updates)
  if (
    req.query.summary === "true" &&
    req.headers["x-requested-with"] === "XMLHttpRequest"
  ) {
    return res.json({ success: true, amount });
  }

  // Regular AJAX or full page request
  if (req.headers["x-requested-with"] === "XMLHttpRequest") {
    res.render("partials/cart", { cart, userId, amount });
  } else {
    res.render("customer/customerCart", {
      role: custrole,
      cart,
      userId,
      amount,
    });
  }
};

export const editCart = async (req, res) => {
  try {
    const { userId, productId, action, amount } = req.query;
    let msg;
    if (action === "add") {
      msg = await addItem(userId, productId);
    } else if (action === "del") {
      msg = await deleteItem(userId, productId);
    } else if (action === "rem") {
      msg = await removeCompleteItem(userId, productId);
    } else if (action === "none") {
      msg = await changeProductAmount(userId, productId, amount);
    }
    res.json(msg);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//Workshops

export const getWorkshopPage = (req, res) => {
  res.render("customer/workshop", { role: custrole });
};

export const bookWorkshopPage = async (req, res) => {
  const { workshopTitle, workshopDesc, date, time } = req.body;
  console.log(workshopTitle, workshopDesc);

  if (!workshopTitle || !workshopDesc || !date || !time) {
    return res
      .status(400)
      .json({ success: false, error: "All fields are required!" });
  }

  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const newWorkshop = await bookWorkshop(
      req.user.id,
      workshopTitle,
      workshopDesc,
      date,
      time
    );

    res.json({
      success: newWorkshop.success,
      message: "Workshop booked!",
      workshop: newWorkshop,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to book workshop" });
  }
};

//Custom orders

export const getCustomOrderPage = (req, res) => {
  res.render("customer/customorder", { role: req.user.role });
};

export const reqCustomOrder = async (req, res) => {
  try {
    const { title, type, description, budget, requiredBy } = req.body;
    if (!title || !type || !description || !budget || !requiredBy) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled!",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    const result = await cloudinary.uploader.upload(req.file.path);
    const newrequest = await addRequest(
      req.user.id,
      title,
      type,
      result.secure_url,
      description,
      budget,
      requiredBy
    );
    res.json({
      success: true,
      message: "Custom order submitted successfully!",
      request: newrequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to submit request please try again later",
    });
  }
};

//checkout Page
export const checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await getCart(userId);

    if (!cart || cart.length === 0) {
      return res.redirect("/customer/orders");
    }

    const products = await getProducts();

    // Calculate total amount
    let amount = 0;
    cart.forEach((item) => {
      if (item) {
        amount += item.productId.newPrice * item.quantity;
      }
    });

    // Calculate shipping and tax
    const shipping = 50; // Fixed shipping fee
    const tax = Math.round(amount * 0.05 * 100) / 100; // 5% tax
    let user = await getUserById(userId);

    res.render("customer/checkout", {
      role: custrole,
      cart,
      products,
      amount: amount.toFixed(2),
      shipping,
      tax,
      user,
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load checkout page" });
  }
};
export const placeOrderController = async (req, res) => {
  try {
    const userId = req.user.id;

    const response = await placeOrder(userId);

    if (response.success) {
      res.status(200).json(response);
    } else {
      res
        .status(500)
        .json({ success: false, message: "Failed to place Order!" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Failed to place Order!" });
  }
};

export const getSettingsCustomer = async (req, res) => {
  const user = await getUserById(req.user.id);
  delete user.password;
  delete user.userId;
  delete user.role;
  res.render("settings", { role: custrole, user });
};

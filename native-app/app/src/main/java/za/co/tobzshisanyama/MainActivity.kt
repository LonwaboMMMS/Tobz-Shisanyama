package za.co.tobzshisanyama

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

private val Ink = Color(0xFF171714)
private val Paper = Color(0xFFF5F2EB)
private val Orange = Color(0xFFF26A21)
private val Muted = Color(0xFF77756F)
private const val API_URL = "https://tobz-shisanyama.pages.dev/api/place-order"
private const val CART_KEY = "tobz-native-cart-v1"

data class Meat(val id: String, val name: String, val price: Int, val symbol: String)
data class CartLine(val id: String, val amount: Double)

private val meats = listOf(
    Meat("pork", "Pork", 105, "P"),
    Meat("beef", "Beef", 115, "B"),
    Meat("wors", "Wors", 95, "W")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Orange,
                    onPrimary = Color.White,
                    background = Paper,
                    surface = Color.White,
                    onSurface = Ink
                )
            ) {
                TobzApp(
                    onPay = { customer, lines, callback -> submitOrder(customer, lines, callback) },
                    openPayment = { url ->
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                )
            }
        }
    }

    private fun submitOrder(
        customer: JSONObject,
        lines: List<CartLine>,
        callback: (Result<String>) -> Unit
    ) {
        Thread {
            try {
                val items = JSONArray()
                lines.forEach { line ->
                    items.put(JSONObject().put("id", line.id).put("amount", line.amount))
                }
                val body = JSONObject().put("customer", customer).put("items", items)
                val connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 20000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val response = stream.bufferedReader().use { it.readText() }
                connection.disconnect()
                val json = JSONObject(response)
                val redirect = json.optString("redirectUrl")
                if (code !in 200..299 || redirect.isBlank()) {
                    throw IllegalStateException(json.optString("error", "We couldn't start checkout. Please try again."))
                }
                callback(Result.success(redirect))
            } catch (error: Exception) {
                callback(Result.failure(error))
            }
        }.start()
    }
}

@Composable
private fun TobzApp(
    onPay: (JSONObject, List<CartLine>, (Result<String>) -> Unit) -> Unit,
    openPayment: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val prefs = remember { context.getSharedPreferences("tobz-native", 0) }
    val cart = remember {
        mutableStateListOf<CartLine>().apply {
            val saved = prefs.getString(CART_KEY, "[]") ?: "[]"
            try {
                val array = JSONArray(saved)
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    add(CartLine(item.getString("id"), item.getDouble("amount")))
                }
            } catch (_: Exception) { clear() }
        }
    }
    var screen by remember { mutableStateOf("home") }
    var selectedCategory by remember { mutableStateOf("All") }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }

    fun persistCart() {
        val array = JSONArray()
        cart.forEach { array.put(JSONObject().put("id", it.id).put("amount", it.amount)) }
        prefs.edit().putString(CART_KEY, array.toString()).apply()
    }
    fun addMeat(meat: Meat, amount: Double) {
        val index = cart.indexOfFirst { it.id == meat.id }
        if (index >= 0) cart[index] = cart[index].copy(amount = cart[index].amount + amount)
        else cart.add(CartLine(meat.id, amount))
        persistCart()
        status = "${meat.name} added to your bag."
    }

    val total = cart.sumOf { it.amount }
    Scaffold(
        containerColor = Paper,
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                listOf("Home", "Menu", "Bag", "About").forEach { label ->
                    NavigationBarItem(
                        selected = screen == label.lowercase(),
                        onClick = { screen = label.lowercase(); status = "" },
                        icon = { Text(when (label) { "Home" -> "⌂"; "Menu" -> "☷"; "Bag" -> "▣"; else -> "✦" }, fontSize = 19.sp) },
                        label = { Text(if (label == "Bag" && cart.isNotEmpty()) "Bag ${cart.size}" else label) }
                    )
                }
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().background(Ink).padding(horizontal = 20.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).background(Orange, RoundedCornerShape(2.dp)), contentAlignment = Alignment.Center) {
                        Text("T", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(10.dp))
                    Text("TOBZ SHISANYAMA", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
                }
                Text("GOOD FOOD. GOOD FIRE.", color = Orange, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            when (screen) {
                "menu" -> MenuScreen(selectedCategory, { selectedCategory = it }, ::addMeat, status)
                "bag" -> BagScreen(
                    cart, total,
                    onRemove = { id -> cart.removeAll { it.id == id }; persistCart() },
                    onChange = { id, value ->
                        val index = cart.indexOfFirst { it.id == id }
                        if (index >= 0 && value > 0) cart[index] = cart[index].copy(amount = value)
                        persistCart()
                    },
                    onCheckout = { screen = "checkout" },
                    status = status
                )
                "checkout" -> CheckoutScreen(
                    name, { name = it }, phone, { phone = it }, notes, { notes = it },
                    total, sending, status,
                    onBack = { screen = "bag" },
                    onSubmit = {
                        if (name.isBlank() || phone.isBlank() || cart.isEmpty()) {
                            status = "Please enter your name and phone number."
                        } else {
                            sending = true
                            status = "Connecting securely to checkout…"
                            val customer = JSONObject()
                                .put("name", name.trim())
                                .put("phone", phone.trim())
                                .put("method", "Collection")
                                .put("address", "")
                                .put("notes", notes.trim())
                            onPay(customer, cart.toList()) { result ->
                                Handler(Looper.getMainLooper()).post {
                                    sending = false
                                    result.onSuccess { paymentUrl ->
                                        cart.clear()
                                        persistCart()
                                        status = "Opening secure Yoco checkout…"
                                        openPayment(paymentUrl)
                                    }.onFailure { error ->
                                        status = error.message ?: "Couldn't connect. Check your internet and try again."
                                    }
                                }
                            }
                        }
                    }
                )
                "about" -> AboutScreen()
                else -> HomeScreen(onMenu = { screen = "menu" }, onBag = { screen = "bag" })
            }
        }
    }
}

@Composable
private fun ScreenTitle(kicker: String, title: String, subtitle: String? = null) {
    Column(Modifier.fillMaxWidth().background(Ink).padding(horizontal = 22.dp, vertical = 25.dp)) {
        Text(kicker.uppercase(), color = Orange, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Text(title, color = Color.White, fontSize = 39.sp, fontWeight = FontWeight.Black, lineHeight = 42.sp)
        if (subtitle != null) Text(subtitle, color = Color.LightGray, fontSize = 12.sp, lineHeight = 19.sp)
    }
}

@Composable
private fun HomeScreen(onMenu: () -> Unit, onBag: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Column(Modifier.fillMaxWidth().background(Ink).padding(24.dp)) {
                Text("FRESH OFF", color = Color.White, fontSize = 52.sp, fontWeight = FontWeight.Black, lineHeight = 52.sp)
                Text("THE FIRE.", color = Orange, fontSize = 52.sp, fontWeight = FontWeight.Black, lineHeight = 52.sp)
                Spacer(Modifier.height(12.dp))
                Text("Your shisanyama favourites, on your terms. Choose what you want to spend and we'll work out the weight.", color = Color.LightGray, fontSize = 14.sp, lineHeight = 22.sp)
                Spacer(Modifier.height(22.dp))
                Button(onClick = onMenu, colors = ButtonDefaults.buttonColors(containerColor = Orange), shape = RoundedCornerShape(3.dp)) {
                    Text("EXPLORE THE MENU  ↗", fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Column(Modifier.padding(22.dp)) {
                Text("SIMPLE AS THAT", color = Orange, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                Text("YOU PICK THE PRICE.\nWE SORT THE WEIGHT.", color = Ink, fontSize = 27.sp, fontWeight = FontWeight.Black, lineHeight = 31.sp)
                Spacer(Modifier.height(9.dp))
                Text("Choose your budget and see the estimated weight before adding it to your bag.", color = Muted, fontSize = 13.sp)
            }
        }
        item {
            meats.forEach { meat ->
                MeatSummary(meat)
            }
            Spacer(Modifier.height(14.dp))
            Button(onClick = onBag, modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp), colors = ButtonDefaults.buttonColors(containerColor = Ink)) {
                Text("VIEW YOUR BAG")
            }
        }
    }
}

@Composable
private fun MeatSummary(meat: Meat) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 5.dp)
            .background(Color(0xFFE9E5DC), RoundedCornerShape(3.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(48.dp).background(Orange, RoundedCornerShape(2.dp)), contentAlignment = Alignment.Center) {
            Text(meat.symbol, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(meat.name.uppercase(), fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text("R${meat.price} / kg", color = Muted, fontSize = 12.sp)
        }
        Text("↗", color = Orange, fontSize = 22.sp)
    }
}

@Composable
private fun MenuScreen(category: String, onCategory: (String) -> Unit, onAdd: (Meat, Double) -> Unit, status: String) {
    var amounts by remember { mutableStateOf(mapOf("pork" to "50", "beef" to "50", "wors" to "50")) }
    Column(Modifier.fillMaxSize()) {
        ScreenTitle("PICK YOUR FAVOURITES", "THE MENU.", "Choose a meat and enter how much you'd like to spend.")
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("All", "Pork", "Beef", "Wors").forEach { item ->
                FilterChip(selected = category == item, onClick = { onCategory(item) }, label = { Text(item) })
            }
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 20.dp)) {
            items(meats.filter { category == "All" || it.name == category }) { meat ->
                val amountText = amounts[meat.id] ?: "50"
                val amount = amountText.toDoubleOrNull() ?: 0.0
                Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp).background(Color.White, RoundedCornerShape(3.dp)).padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(54.dp).background(Color(0xFFE9E5DC), RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
                            Text(meat.symbol, color = Orange, fontSize = 28.sp, fontWeight = FontWeight.Black)
                        }
                        Spacer(Modifier.width(13.dp))
                        Column {
                            Text(meat.name.uppercase(), color = Orange, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                            Text("R${meat.price}.00 / kg", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text("HOW MUCH WOULD YOU LIKE TO SPEND?", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amounts = amounts + (meat.id to it.filter { c -> c.isDigit() || c == '.' }) },
                        modifier = Modifier.fillMaxWidth(),
                        prefix = { Text("R") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    )
                    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("YOU'LL GET", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Text(if (amount > 0) "${"%.2f".format(amount / meat.price)} kg" else "— kg", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { if (amount > 0) onAdd(meat, amount) },
                        enabled = amount > 0,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Ink),
                        shape = RoundedCornerShape(2.dp)
                    ) { Text("ADD TO BAG  +", fontWeight = FontWeight.Bold) }
                }
            }
        }
        if (status.isNotBlank()) Text(status, Modifier.padding(12.dp), color = Orange, fontSize = 12.sp)
    }
}

@Composable
private fun BagScreen(
    cart: List<CartLine>, total: Double,
    onRemove: (String) -> Unit, onChange: (String, Double) -> Unit,
    onCheckout: () -> Unit, status: String
) {
    Column(Modifier.fillMaxSize()) {
        ScreenTitle("YOUR ORDER", "YOUR BAG.")
        if (cart.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Your bag is empty", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Head to the menu and add something for the fire.", color = Muted, fontSize = 12.sp)
                }
            }
        } else {
            LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(18.dp)) {
                items(cart) { line ->
                    val meat = meats.first { it.id == line.id }
                    Column(Modifier.fillMaxWidth().padding(bottom = 12.dp).background(Color.White).padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(meat.name, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text("R${"%.2f".format(line.amount)}", fontWeight = FontWeight.Bold)
                        }
                        Text("${"%.2f".format(line.amount / meat.price)} kg · R${meat.price}/kg", color = Muted, fontSize = 12.sp)
                        TextButton(onClick = { onRemove(line.id) }) { Text("REMOVE", color = Orange) }
                    }
                }
            }
            Column(Modifier.fillMaxWidth().background(Color.White).padding(20.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("SUBTOTAL", fontWeight = FontWeight.Bold)
                    Text("R${"%.2f".format(total)}", fontWeight = FontWeight.Black, fontSize = 20.sp)
                }
                Spacer(Modifier.height(12.dp))
                Button(onClick = onCheckout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Orange)) {
                    Text("CONTINUE TO CHECKOUT")
                }
            }
        }
        if (status.isNotBlank()) Text(status, Modifier.padding(10.dp), color = Orange, fontSize = 12.sp)
    }
}

@Composable
private fun CheckoutScreen(
    name: String, onName: (String) -> Unit,
    phone: String, onPhone: (String) -> Unit,
    notes: String, onNotes: (String) -> Unit,
    total: Double, sending: Boolean, status: String,
    onBack: () -> Unit, onSubmit: () -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        ScreenTitle("ALMOST THERE", "CHECKOUT.", "Collection only. Payment is completed securely through Yoco.")
        Column(Modifier.weight(1f).padding(18.dp)) {
            Text("YOUR DETAILS", fontWeight = FontWeight.Black, fontSize = 18.sp)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(name, onName, label = { Text("Full name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(phone, onPhone, label = { Text("Phone number *") }, modifier = Modifier.fillMaxWidth(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            OutlinedTextField(notes, onNotes, label = { Text("Order notes (optional)") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("ORDER TOTAL", fontWeight = FontWeight.Bold)
                Text("R${"%.2f".format(total)}", fontWeight = FontWeight.Black, fontSize = 21.sp)
            }
            Spacer(Modifier.height(14.dp))
            Button(onClick = onSubmit, enabled = !sending, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Orange)) {
                Text(if (sending) "CONNECTING…" else "CONTINUE TO YOCO PAYMENT")
            }
            TextButton(onClick = onBack) { Text("← BACK TO BAG", color = Ink) }
            if (status.isNotBlank()) Text(status, color = Orange, fontSize = 12.sp)
        }
    }
}

@Composable
private fun AboutScreen() {
    Column(Modifier.fillMaxSize()) {
        ScreenTitle("A LITTLE ABOUT US", "MORE THAN\nJUST MEAT.", "Good food. Good company. That unmistakable shisanyama feeling.")
        Column(Modifier.padding(22.dp)) {
            Text("GOOD FOOD BRINGS PEOPLE TOGETHER.", fontSize = 24.sp, fontWeight = FontWeight.Black, lineHeight = 28.sp)
            Spacer(Modifier.height(12.dp))
            Text("Tobz Shisanyama is about keeping things simple: great meat, honest prices and the joy of sharing a proper meal. Whether it's pork, beef or wors, you choose what you'd like to spend and we calculate the weight for you.", color = Muted, fontSize = 14.sp, lineHeight = 22.sp)
        }
    }
}

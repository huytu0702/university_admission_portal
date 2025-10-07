from locust import HttpUser, task, between, events
import random
import string
import json

class UniversityPortalUser(HttpUser):
    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.application_id = None
        
    def on_start(self):
        """Called when a Locust user starts"""
        self.register_and_login()
        
    def generate_random_string(self, length=10):
        """Generate a random string of specified length"""
        letters = string.ascii_lowercase
        return ''.join(random.choice(letters) for i in range(length))
        
    def register_and_login(self):
        """Register a new user and login to get auth token"""
        # Generate random user data
        random_suffix = self.generate_random_string(8)
        user_data = {
            "email": f"test_{random_suffix}@example.com",
            "password": "TestPass123!",
            "firstName": f"FirstName_{random_suffix}",
            "lastName": f"LastName_{random_suffix}"
        }
        
        # Register the user
        with self.client.post("/auth/register", 
                             json=user_data, 
                             name="Register User",
                             catch_response=True) as response:
            if response.status_code != 201:
                response.failure(f"Registration failed with status {response.status_code}")
                return
                
        # Login to get auth token
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        with self.client.post("/auth/login", 
                             json=login_data, 
                             name="Login User",
                             catch_response=True) as response:
            if response.status_code == 200:
                self.auth_token = response.json().get("access_token")
                response.success()
            else:
                response.failure(f"Login failed with status {response.status_code}")
                
    @task(10)  # Higher weight - more likely to be executed
    def submit_application(self):
        """Submit a new application"""
        if not self.auth_token:
            return
            
        # Sample application data
        application_data = {
            "personalStatement": """This is a comprehensive personal statement that demonstrates my qualifications, 
                                   experiences, and motivations for pursuing higher education. Throughout my academic 
                                   journey, I have consistently challenged myself to excel in rigorous coursework 
                                   while maintaining a strong commitment to community service and leadership."""
        }
        
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        
        with self.client.post("/applications", 
                              json=application_data,
                              headers=headers,
                              name="Submit Application",
                              catch_response=True) as response:
            if response.status_code == 201:
                self.application_id = response.json().get("id")
                response.success()
            else:
                response.failure(f"Application submission failed with status {response.status_code}")
                
    @task(5)  # Medium weight
    def get_application_details(self):
        """Get details of a previously submitted application"""
        if not self.auth_token or not self.application_id:
            return
            
        headers = {
            "Authorization": f"Bearer {self.auth_token}"
        }
        
        with self.client.get(f"/applications/{self.application_id}", 
                            headers=headers,
                            name="Get Application Details",
                            catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get application details failed with status {response.status_code}")
                
    @task(3)  # Lower weight
    def initiate_payment(self):
        """Initiate payment for an application"""
        if not self.auth_token or not self.application_id:
            return
            
        payment_data = {
            "applicationId": self.application_id,
            "amount": 7500,  # $75.00
            "currency": "usd"
        }
        
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        
        with self.client.post("/payments/checkout", 
                             json=payment_data,
                             headers=headers,
                             name="Initiate Payment",
                             catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Payment initiation failed with status {response.status_code}")

# Event hooks for additional metrics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load test starting...")
    
@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Load test completed.")
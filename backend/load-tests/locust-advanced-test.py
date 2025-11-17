"""
Advanced Locust Load Test with Custom Scenarios
Includes pattern-specific tests and advanced user behaviors
"""

from locust import HttpUser, task, between, events, TaskSet
import random
import string
import json
import time

class UniversityPortalUser(HttpUser):
    """Base user class with authentication"""
    wait_time = between(1, 5)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.application_ids = []
        
    def on_start(self):
        """Called when a Locust user starts"""
        self.register_and_login()
        
    def generate_random_string(self, length=10):
        """Generate a random string of specified length"""
        letters = string.ascii_lowercase
        return ''.join(random.choice(letters) for i in range(length))
        
    def register_and_login(self):
        """Register a new user and login to get auth token"""
        random_suffix = self.generate_random_string(8)
        user_data = {
            "email": f"locust_{random_suffix}@example.com",
            "password": "LocustTest123!",
            "firstName": f"Locust_{random_suffix}",
            "lastName": f"User_{random_suffix}"
        }
        
        # Register the user
        with self.client.post("/auth/register", 
                             json=user_data, 
                             name="01_Register_User",
                             catch_response=True) as response:
            if response.status_code != 201:
                response.failure(f"Registration failed: {response.status_code}")
                return
                
        # Login to get auth token
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        with self.client.post("/auth/login", 
                             json=login_data, 
                             name="02_Login_User",
                             catch_response=True) as response:
            if response.status_code == 200:
                self.auth_token = response.json().get("access_token")
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")


class NormalUserBehavior(TaskSet):
    """Normal user behavior - typical application submission flow"""
    
    @task(10)
    def complete_application_flow(self):
        """Complete end-to-end application submission"""
        if not self.user.auth_token:
            return
            
        # Submit application
        application_data = {
            "personalStatement": f"""This is application #{len(self.user.application_ids) + 1}. 
                I am passionate about pursuing higher education and believe this program aligns 
                perfectly with my career goals and aspirations. My academic background and 
                professional experience have prepared me well for this next step."""
        }
        
        headers = {"Authorization": f"Bearer {self.user.auth_token}"}
        
        with self.client.post("/applications", 
                              json=application_data,
                              headers=headers,
                              name="03_Submit_Application",
                              catch_response=True) as response:
            if response.status_code in [201, 202]:
                app_id = response.json().get("id")
                self.user.application_ids.append(app_id)
                response.success()
                
                # Check application status
                time.sleep(1)
                self.check_application_status(app_id)
                
                # Initiate payment
                time.sleep(2)
                self.process_payment(app_id)
            else:
                response.failure(f"Application submission failed: {response.status_code}")
    
    def check_application_status(self, app_id):
        """Check status of submitted application"""
        headers = {"Authorization": f"Bearer {self.user.auth_token}"}
        
        with self.client.get(f"/applications/{app_id}", 
                            headers=headers,
                            name="04_Check_Status",
                            catch_response=True) as response:
            if response.status_code == 200:
                status = response.json().get("status")
                response.success()
            else:
                response.failure(f"Status check failed: {response.status_code}")
    
    def process_payment(self, app_id):
        """Process payment for application"""
        payment_data = {
            "applicationId": app_id,
            "amount": 7500,
            "currency": "usd"
        }
        
        headers = {"Authorization": f"Bearer {self.user.auth_token}"}
        
        with self.client.post("/payments/checkout", 
                             json=payment_data,
                             headers=headers,
                             name="05_Process_Payment",
                             catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Payment failed: {response.status_code}")


class HeavyUserBehavior(TaskSet):
    """Heavy user - submits multiple applications in quick succession"""
    
    @task
    def bulk_application_submission(self):
        """Submit multiple applications rapidly"""
        if not self.user.auth_token:
            return
            
        headers = {"Authorization": f"Bearer {self.user.auth_token}"}
        
        # Submit 3-5 applications rapidly
        num_applications = random.randint(3, 5)
        
        for i in range(num_applications):
            application_data = {
                "personalStatement": f"Bulk application #{i + 1} submitted by heavy user."
            }
            
            with self.client.post("/applications", 
                                  json=application_data,
                                  headers=headers,
                                  name="Heavy_Submit_Application",
                                  catch_response=True) as response:
                if response.status_code in [201, 202]:
                    response.success()
                else:
                    response.failure(f"Bulk submission failed: {response.status_code}")
            
            # Very short wait between submissions
            time.sleep(0.5)


class StatusPollerBehavior(TaskSet):
    """User that constantly polls application status"""
    
    @task
    def poll_status_repeatedly(self):
        """Poll application status multiple times"""
        if not self.user.auth_token or not self.user.application_ids:
            return
            
        headers = {"Authorization": f"Bearer {self.user.auth_token}"}
        
        # Pick a random application and poll it multiple times
        app_id = random.choice(self.user.application_ids)
        
        for i in range(5):
            with self.client.get(f"/applications/{app_id}", 
                                headers=headers,
                                name="Poll_Status",
                                catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Status poll failed: {response.status_code}")
            
            time.sleep(1)


class NormalApplicationUser(UniversityPortalUser):
    """Normal user with standard behavior"""
    tasks = [NormalUserBehavior]
    weight = 7


class HeavyApplicationUser(UniversityPortalUser):
    """Heavy user submitting multiple applications"""
    tasks = [HeavyUserBehavior]
    weight = 2


class StatusCheckerUser(UniversityPortalUser):
    """User that frequently checks application status"""
    tasks = [StatusPollerBehavior]
    weight = 1


# Custom metrics tracking
request_success_count = 0
request_failure_count = 0

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Track request metrics"""
    global request_success_count, request_failure_count
    
    if exception:
        request_failure_count += 1
    else:
        request_success_count += 1


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("\n" + "="*60)
    print("Advanced Locust Load Test Starting")
    print("="*60)
    print(f"Target Host: {environment.host}")
    print(f"User Classes: NormalUser (70%), HeavyUser (20%), StatusChecker (10%)")
    print("="*60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops"""
    print("\n" + "="*60)
    print("Advanced Locust Load Test Completed")
    print("="*60)
    
    stats = environment.stats
    
    print(f"\nTotal Requests: {stats.total.num_requests}")
    print(f"Total Failures: {stats.total.num_failures}")
    print(f"Average Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Median Response Time: {stats.total.median_response_time:.2f}ms")
    print(f"95th Percentile: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"99th Percentile: {stats.total.get_response_time_percentile(0.99):.2f}ms")
    print(f"Requests/sec: {stats.total.total_rps:.2f}")
    
    if stats.total.num_requests > 0:
        failure_rate = (stats.total.num_failures / stats.total.num_requests) * 100
        print(f"Failure Rate: {failure_rate:.2f}%")
    
    print("="*60 + "\n")

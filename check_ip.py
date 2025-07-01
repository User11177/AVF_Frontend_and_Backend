import  requests
import datetime
import socket


def get_current_ip():
    try:
        return  requests.get("https://api.ipify.org").text
    except:
        return None

def get_dns_ip():
    try:
        return  socket.gethostbyname("avfcare.com")
    except:
        return None

zone_id = "df1c136603b13187de631611b7ed7dee"
record_id = "5d637c48755c508a725263e99fc6c3c4"
domain = "avfcare.com"
api_token = "nt5KK1Ss27OIdMYBhQ0tgEJhG0FlDtmBrtDlPnYe"
ip = requests.get("https://api.ipify.org").text.strip()
logfile = "/home/user/Desktop/AVFAPP/ip_log.txt"

now_time = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
current_ip = get_current_ip()
dns_ip = get_dns_ip()


with open(logfile, "a") as f:
    f.write(f"{now_time} | current: {current_ip} | dns: {dns_ip}\n")
    if current_ip != dns_ip:
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

        data = {
            "type" : "A",
            "name" : domain,
            "content" : ip,
            "ttl":1,
            "proxied":False
        }

        response = requests.put(
            f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}",
            headers=headers,
            json=data
        )

        f.write("IP changed!\n")

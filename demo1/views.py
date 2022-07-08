from django.shortcuts import render, HttpResponse

# Create your views here.
def index(request):
    return HttpResponse("welcome")

def demo1(request):
    return render(request, "demo1/index.html")

def demo2(request):
    return render(request, "demo2/gif.html")

def demo3(request):
    return render(request, "demo3/capture-to-file.html")

def demo4(request):
    return render(request, "demo4/index.html")

def demo5(request):
    return render(request, "demo5/index.html")
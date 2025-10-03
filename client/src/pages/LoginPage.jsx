import Login from '../components/auth/Login';

const LoginPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-medium text-gray-900">
                        Sign in to your account
                    </h2>
                </div>
                <div className="px-8 w-full">
                    <Login />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;